
import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig, AuditLog } from '../types';
import { db as firestore } from './firebase';
import { auth } from './auth';
import { AuditService } from './audit';
import { COLLECTIONS } from './firestorePaths';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where, orderBy, limit, serverTimestamp, Timestamp } from "firebase/firestore";
import { extractAiTags, getAiCooldownSeconds } from './gemini';

// --- Helper: Deep Masking for Staff View ---
const deepMask = (obj: any): any => {
  if (!obj) return obj;
  const user = auth.getCurrentUser();
  // Boss/Manager see everything
  if (!user || user.role === 'BOSS' || user.role === 'MANAGER') return obj;
  // Decoy sees nothing
  if (user.role === 'DECOY') return {};

  const sensitiveKeys = ['amount', 'total_amount', 'totalPaid', 'cost', 'revenue', 'netProfit', 'salary', 'bossSalary', 'partnerSalary', 'insuranceCost'];
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in masked) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      masked[key] = typeof obj[key] === 'number' ? -1 : '****';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = deepMask(masked[key]);
    }
  }
  return masked;
};

// --- Helper: Standardized Error Handling ---
const handleDbError = (context: string, error: any) => {
  console.error(`[Firestore Error] ${context}:`, error);
  console.error(`Details: Code=${error.code}, Message=${error.message}`);
  throw error; // Re-throw to let UI handle it
};

// --- Repository Implementation ---

export const db = {
  // 1. Customers Repo
  customers: {
    list: async (params: { q?: string } = {}) => {
      try {
        console.log("[DB] Fetching customers...");
        // CRITICAL FIX: Do NOT use where('deleted_at', '==', null) server-side.
        // Legacy data might not have the field, causing it to be hidden.
        // Fetch all, filter client-side.
        const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
        const qRef = query(ref, limit(1000)); // Safety limit
        
        const snap = await getDocs(qRef);
        console.log(`[DB] Fetched ${snap.size} customers raw.`);

        let list = snap.docs.map(d => ({ ...d.data(), customer_id: d.id } as Customer));
        
        // Client-side Filter: Deleted
        list = list.filter(c => !c.deleted_at);

        // Client-side Filter: Search Query
        if (params.q) {
          const lowerQ = params.q.toLowerCase();
          list = list.filter(c => 
            c.displayName?.toLowerCase().includes(lowerQ) || 
            c.contactName?.toLowerCase().includes(lowerQ) ||
            c.phones?.some(p => p.number.includes(lowerQ)) ||
            c.addresses?.some(a => a.text.includes(lowerQ))
          );
        }

        return list.map(c => deepMask(c));
      } catch (error) {
        handleDbError('listCustomers', error);
        return [];
      }
    },
    getAll: async () => {
      // Alias for compatibility
      return db.customers.list(); 
    },
    get: async (id: string) => {
      try {
        const snap = await getDoc(doc(firestore, COLLECTIONS.CUSTOMERS, id));
        if (!snap.exists()) return undefined;
        return deepMask({ ...snap.data(), customer_id: snap.id } as Customer);
      } catch (e) {
        handleDbError('getCustomer', e);
      }
    },
    save: async (customer: Customer) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.CUSTOMERS, customer.customer_id);
        const snap = await getDoc(ref);
        const now = new Date().toISOString();
        
        const displayName = customer.customerType === '公司'
          ? `${customer.companyName || ''} ${customer.contactName}`.trim()
          : customer.contactName;
        
        const dataToSave = { ...customer, displayName, updated_at: now };
        
        if (snap.exists()) {
          const before = snap.data();
          await setDoc(ref, dataToSave, { merge: true });
          await AuditService.log({
            action: 'UPDATE', module: 'CUSTOMER', entityId: customer.customer_id,
            entityName: displayName, summary: `更新村民: ${displayName}`, before, after: dataToSave
          }, auth.getCurrentUser());
        } else {
          dataToSave.created_at = now;
          await setDoc(ref, dataToSave);
          await AuditService.log({
            action: 'CREATE', module: 'CUSTOMER', entityId: customer.customer_id,
            entityName: displayName, summary: `新增村民: ${displayName}`, after: dataToSave
          }, auth.getCurrentUser());
        }
      } catch (e) {
        handleDbError('saveCustomer', e);
      }
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.CUSTOMERS, id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const before = snap.data();
          await updateDoc(ref, { deleted_at: new Date().toISOString() });
          await AuditService.log({
            action: 'DELETE', module: 'CUSTOMER', entityId: id,
            entityName: before.displayName, summary: `刪除村民: ${before.displayName}`, before
          }, auth.getCurrentUser());
        }
      } catch (e) {
        handleDbError('deleteCustomer', e);
      }
    },
    generateId: () => `C${Date.now().toString(36).toUpperCase()}`
  },

  // 2. Jobs Repo
  jobs: {
    list: async (params: { startDate?: string, endDate?: string, q?: string } = {}) => {
      try {
        console.log("[DB] Fetching jobs...", params);
        // CRITICAL FIX: Fetch all first, then filter. Avoids index requirements for basic view.
        const ref = collection(firestore, COLLECTIONS.JOBS);
        // orderBy 'serviceDate' requires index if mixed with where. Let's do raw fetch first.
        // We limit to 500 recent jobs to prevent explosion.
        // Ideally: orderBy('serviceDate', 'desc')
        let qRef = query(ref, orderBy('serviceDate', 'desc'), limit(500));
        
        // Fallback: If orderBy fails due to index, try basic fetch
        let snap;
        try {
           snap = await getDocs(qRef);
        } catch (idxError: any) {
           console.warn("[DB] Index missing for sort, falling back to basic fetch.", idxError.message);
           qRef = query(ref, limit(500));
           snap = await getDocs(qRef);
        }

        console.log(`[DB] Fetched ${snap.size} jobs raw.`);

        let list = snap.docs.map(d => ({ ...d.data(), jobId: d.id } as Job));

        // Client-side Filter: Deleted
        list = list.filter(j => !j.deletedAt);

        // Client-side Filter: Date Range
        if (params.startDate) {
          list = list.filter(j => j.serviceDate >= params.startDate!);
        }
        if (params.endDate) {
          list = list.filter(j => j.serviceDate <= params.endDate!);
        }

        // Client-side Filter: Search
        if (params.q) {
          const lower = params.q.toLowerCase();
          list = list.filter(j => 
            j.contactPerson?.toLowerCase().includes(lower) || 
            j.contactPhone?.includes(lower) || 
            j.jobId.toLowerCase().includes(lower)
          );
        }

        return list.map(j => deepMask(j));
      } catch (error) {
        handleDbError('listJobs', error);
        return [];
      }
    },
    getAll: async () => {
      return db.jobs.list();
    },
    save: async (job: Job, options: { skipAi?: boolean } = {}) => {
      if (!auth.canWrite()) return job;
      try {
        const ref = doc(firestore, COLLECTIONS.JOBS, job.jobId);
        const snap = await getDoc(ref);
        const now = new Date().toISOString();
        
        // Fix: Add timestamps fields for better querying later
        const jobToSave = { 
          ...job, 
          updatedAt: now,
          serviceDateStr: job.serviceDate, // Explicit string field
          serviceDateTs: job.serviceDate ? Timestamp.fromDate(new Date(job.serviceDate)) : null
        };

        if (snap.exists()) {
          const before = snap.data();
          await setDoc(ref, jobToSave, { merge: true });
          await AuditService.log({
            action: 'UPDATE', module: 'JOB', entityId: job.jobId,
            entityName: `${job.serviceDate} ${job.contactPerson}`, summary: `更新工單`, before, after: jobToSave
          }, auth.getCurrentUser());
        } else {
          jobToSave.createdAt = now;
          await setDoc(ref, jobToSave);
          await AuditService.log({
            action: 'CREATE', module: 'JOB', entityId: job.jobId,
            entityName: `${job.serviceDate} ${job.contactPerson}`, summary: `新增工單`, after: jobToSave
          }, auth.getCurrentUser());
        }

        // Sync Customer Last Service
        if (job.status === JobStatus.COMPLETED) {
           // ... (Same sync logic as before) ...
           try {
             const custRef = doc(firestore, COLLECTIONS.CUSTOMERS, job.customerId);
             const custSnap = await getDoc(custRef);
             if (custSnap.exists()) {
               const custData = custSnap.data() as Customer;
               let newTags = custData.ai_tags || [];
               if (!options.skipAi && getAiCooldownSeconds() === 0 && job.serviceNote) {
                  try {
                    const generated = await extractAiTags(job.serviceNote);
                    newTags = Array.from(new Set([...newTags, ...generated])).slice(0, 10);
                  } catch(e) { console.warn("AI skipped", e); }
               }
               await updateDoc(custRef, {
                 is_returning: true,
                 last_service_date: job.serviceDate,
                 last_service_summary: job.serviceItems.join(', '),
                 ai_tags: newTags,
                 updated_at: now
               });
             }
           } catch (e) { console.error("Sync customer failed", e); }
        }
        return jobToSave as Job;
      } catch (e) {
        handleDbError('saveJob', e);
        return job;
      }
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.JOBS, id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const before = snap.data();
          await updateDoc(ref, { deletedAt: new Date().toISOString() });
          await AuditService.log({
            action: 'DELETE', module: 'JOB', entityId: id,
            entityName: before.contactPerson, summary: `刪除工單`, before
          }, auth.getCurrentUser());
        }
      } catch (e) {
        handleDbError('deleteJob', e);
      }
    },
    generateId: () => `JOB-${Date.now()}`
  },

  // 3. Expenses Repo
  expenses: {
    list: async (params: { startDate?: string, endDate?: string } = {}) => {
      try {
        const ref = collection(firestore, COLLECTIONS.EXPENSES);
        // Fallback to basic fetch if index issues arise
        let snap;
        try {
           const q = query(ref, orderBy('date', 'desc'), limit(500));
           snap = await getDocs(q);
        } catch {
           snap = await getDocs(query(ref, limit(500)));
        }
        
        let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
        
        list = list.filter(e => !e.deletedAt);
        if (params.startDate) list = list.filter(e => e.date >= params.startDate!);
        if (params.endDate) list = list.filter(e => e.date <= params.endDate!);
        
        return list.map(e => deepMask(e));
      } catch (e) {
        console.error("Expenses list failed (might be missing collection)", e);
        return []; // Return empty if collection doesn't exist yet
      }
    },
    getAll: async () => db.expenses.list(),
    save: async (expense: Expense) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.EXPENSES, expense.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await setDoc(ref, expense, { merge: true });
        } else {
          await setDoc(ref, expense);
        }
        // Simplified audit for expenses to save space
      } catch (e) { handleDbError('saveExpense', e); }
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.EXPENSES, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
      } catch (e) { handleDbError('deleteExpense', e); }
    },
    generateId: () => `EXP-${Date.now()}`
  },

  // 4. Audit Repo
  audit: {
    getAll: async () => {
      try {
        const q = query(collection(firestore, COLLECTIONS.AUDIT_LOGS), orderBy('ts', 'desc'), limit(50));
        const snap = await getDocs(q);
        return snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, createdAt: data.createdAt || (data.ts ? new Date(data.ts.seconds * 1000).toISOString() : '') } as AuditLog;
        });
      } catch (e) {
        console.warn("Audit logs fetch failed:", e);
        return [];
      }
    }
  },

  // 5. Settings Repo
  settings: {
    get: async (): Promise<AppSettings> => {
      try {
        const ref = doc(firestore, COLLECTIONS.SETTINGS, 'global');
        const snap = await getDoc(ref);
        const def = {
          monthlyTarget: 150000,
          monthlySalary: 60000,
          laborBreakdown: { bossSalary: 30000, partnerSalary: 30000 },
          consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 }
        };
        if (snap.exists()) {
          return deepMask({ ...def, ...snap.data() });
        }
        return def;
      } catch (e) {
        // Fallback silently for settings
        return { monthlyTarget: 150000, monthlySalary: 60000, laborBreakdown: { bossSalary: 30000, partnerSalary: 30000 }, consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 } };
      }
    },
    save: async (settings: AppSettings) => {
      if (!auth.canWrite()) return;
      try {
        const ref = doc(firestore, COLLECTIONS.SETTINGS, 'global');
        await setDoc(ref, settings, { merge: true });
        await AuditService.log({
          action: 'UPDATE', module: 'SETTINGS', entityId: 'global', summary: '更新系統參數'
        }, auth.getCurrentUser());
      } catch (e) { handleDbError('saveSettings', e); }
    }
  },

  // 6. L2 Sub-modules
  l2: {
    assets: {
      getAll: async () => {
        try {
          const q = query(collection(firestore, COLLECTIONS.L2_ASSETS)); // simplified query
          const snap = await getDocs(q);
          let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as L2Asset));
          list = list.filter(i => !i.deletedAt);
          return list.map(i => deepMask(i));
        } catch (e) { return []; }
      },
      save: async (item: L2Asset) => {
        if (!auth.canWrite()) return;
        try {
          const ref = doc(firestore, COLLECTIONS.L2_ASSETS, item.id);
          await setDoc(ref, item, { merge: true });
        } catch (e) { handleDbError('saveAsset', e); }
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLLECTIONS.L2_ASSETS, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2A-${Date.now()}`
    },
    stock: {
      getAll: async () => {
        try {
          const q = query(collection(firestore, COLLECTIONS.L2_STOCK));
          const snap = await getDocs(q);
          let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as L2StockLog));
          list = list.filter(i => !i.deletedAt);
          return list.map(i => deepMask(i));
        } catch (e) { return []; }
      },
      save: async (item: L2StockLog) => {
        if (!auth.canWrite()) return;
        try {
          const ref = doc(firestore, COLLECTIONS.L2_STOCK, item.id);
          await setDoc(ref, item, { merge: true });
        } catch (e) { handleDbError('saveStock', e); }
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLLECTIONS.L2_STOCK, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: async (): Promise<L2LaborConfig> => {
        try {
          const ref = doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor');
          const snap = await getDoc(ref);
          const def = { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 };
          return snap.exists() ? deepMask({ ...def, ...snap.data() }) : def;
        } catch (e) { return { bossSalary: 0, partnerSalary: 0, insuranceCost: 0 }; }
      },
      save: async (cfg: L2LaborConfig) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor');
        await setDoc(ref, cfg, { merge: true });
      }
    }
  },

  // 7. Dashboard Summary (Aggregated)
  dashboard: {
    getSummary: async (startDate: string, endDate: string) => {
      // Fetch raw lists and aggregate in JS to avoid complex Firestore aggregations
      const jobs = await db.jobs.list({ startDate, endDate });
      const expenses = await db.expenses.list({ startDate, endDate });
      
      const revenue = jobs.reduce((sum, j) => sum + (j.financial?.total_amount || j.totalPaid || 0), 0);
      const cost = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      return {
        revenue,
        cost,
        netProfit: revenue - cost,
        jobCount: jobs.length,
        expenseCount: expenses.length,
        recentJobs: jobs.slice(0, 20) // Provide recent for display
      };
    }
  }
};

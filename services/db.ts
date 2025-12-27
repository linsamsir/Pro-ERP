
import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig, User, AuditLog, UserRole } from '../types';
import { db as firestore } from './firebase';
import { auth } from './auth';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { extractAiTags, getAiCooldownSeconds } from './gemini';

// Collection Names
const COLL = {
  CUSTOMERS: 'customers',
  JOBS: 'jobs',
  EXPENSES: 'expenses',
  SETTINGS: 'settings', // Doc ID: 'global'
  L2_ASSETS: 'l2_assets',
  L2_STOCK: 'l2_stock',
  AUDIT: 'audit_logs'
};

// --- Helper: Deep Masking for Staff ---
const deepMask = (obj: any): any => {
  if (!obj) return obj;
  const user = auth.getCurrentUser();
  if (!user || user.role === 'BOSS' || user.role === 'MANAGER') return obj;
  if (user.role === 'DECOY') return {}; // Decoy sees nothing

  const sensitiveKeys = ['amount', 'total_amount', 'totalPaid', 'cost', 'revenue', 'netProfit', 'salary', 'bossSalary', 'partnerSalary', 'insuranceCost'];
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in masked) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      masked[key] = -1; // Number mask
      if (typeof obj[key] === 'string') masked[key] = '****';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = deepMask(masked[key]);
    }
  }
  return masked;
};

// --- Helper: Audit Logging ---
const logChange = async (
  module: AuditLog['module'],
  action: AuditLog['action'],
  target: AuditLog['target'],
  summary: string,
  diff?: AuditLog['diff']
) => {
  const actor = auth.getCurrentUser();
  if (!actor) return;

  try {
    await addDoc(collection(firestore, COLL.AUDIT), {
      createdAt: new Date().toISOString(),
      actor: { userId: actor.id, name: actor.name, role: actor.role },
      module,
      action,
      target,
      summary,
      diff: diff || null
    });
  } catch (e) {
    console.error("Audit Log Failed:", e);
  }
};

// --- Helper: Diff Calculator ---
const calculateDiff = (before: any, after: any) => {
  const diff: any = { before: {}, after: {} };
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  allKeys.forEach(key => {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      diff.before[key] = before?.[key];
      diff.after[key] = after?.[key];
    }
  });
  return diff;
};

export const db = {
  users: { init: () => {} }, // Deprecated
  
  audit: {
    getAll: async () => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return [];
      
      const q = query(collection(firestore, COLL.AUDIT), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
      return user?.role === 'STAFF' ? deepMask(logs) : logs;
    }
  },

  customers: {
    getAll: async () => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return [];

      const q = query(collection(firestore, COLL.CUSTOMERS), where('deleted_at', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Customer);
      return user?.role === 'STAFF' ? list.map(c => deepMask(c)) : list;
    },
    get: async (id: string) => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return undefined;

      const snap = await getDoc(doc(firestore, COLL.CUSTOMERS, id));
      if (!snap.exists()) return undefined;
      const data = snap.data() as Customer;
      return user?.role === 'STAFF' ? deepMask(data) : data;
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.CUSTOMERS, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const before = snap.data();
        await updateDoc(ref, { deleted_at: new Date().toISOString() });
        logChange('CUSTOMER', 'DELETE', { entityType: 'Customer', entityId: id, entityName: before.displayName }, `刪除村民: ${before.displayName}`, { before });
      }
    },
    save: async (customer: Customer) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.CUSTOMERS, customer.customer_id);
      const snap = await getDoc(ref);
      const now = new Date().toISOString();
      
      const displayName = customer.customerType === '公司'
        ? `${customer.companyName || ''} ${customer.contactName}`.trim()
        : customer.contactName;
      
      const dataToSave = { ...customer, displayName, updated_at: now };
      
      if (snap.exists()) {
        const before = snap.data();
        const diff = calculateDiff(before, dataToSave);
        await setDoc(ref, dataToSave, { merge: true });
        logChange('CUSTOMER', 'UPDATE', { entityType: 'Customer', entityId: customer.customer_id, entityName: displayName }, `更新村民: ${displayName}`, diff);
      } else {
        dataToSave.created_at = now;
        await setDoc(ref, dataToSave);
        logChange('CUSTOMER', 'CREATE', { entityType: 'Customer', entityId: customer.customer_id, entityName: displayName }, `新增村民: ${displayName}`, { after: dataToSave });
      }
    },
    generateId: () => {
      // Client-side gen for simplicity, but robust enough
      return `C${Date.now().toString(36).toUpperCase()}`;
    }
  },

  jobs: {
    getAll: async () => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return [];

      const q = query(collection(firestore, COLL.JOBS), where('deletedAt', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Job);
      return user?.role === 'STAFF' ? list.map(j => deepMask(j)) : list;
    },
    // New: Find jobs by Customer ID (for phone search linkage)
    getByCustomerId: async (cid: string) => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return [];
      
      const q = query(collection(firestore, COLL.JOBS), where('customerId', '==', cid), where('deletedAt', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Job);
      return user?.role === 'STAFF' ? list.map(j => deepMask(j)) : list;
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.JOBS, id);
      const snap = await getDoc(ref);
      if(snap.exists()) {
        const before = snap.data();
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
        logChange('JOB', 'DELETE', { entityType: 'Job', entityId: id, entityName: before.contactPerson }, `刪除工單`, { before });
      }
    },
    save: async (job: Job, options: { skipAi?: boolean } = {}) => {
      if (!auth.canWrite()) return job;
      const ref = doc(firestore, COLL.JOBS, job.jobId);
      const snap = await getDoc(ref);
      const now = new Date().toISOString();
      const jobToSave = { ...job, updatedAt: now };

      if (snap.exists()) {
        const before = snap.data();
        const diff = calculateDiff(before, jobToSave);
        await setDoc(ref, jobToSave, { merge: true });
        logChange('JOB', 'UPDATE', { entityType: 'Job', entityId: job.jobId, entityName: job.contactPerson }, `更新工單`, diff);
      } else {
        jobToSave.createdAt = now;
        await setDoc(ref, jobToSave);
        logChange('JOB', 'CREATE', { entityType: 'Job', entityId: job.jobId, entityName: job.contactPerson }, `新增工單`, { after: jobToSave });
      }

      // Sync logic (update Customer)
      if (job.status === JobStatus.COMPLETED) {
        const custRef = doc(firestore, COLL.CUSTOMERS, job.customerId);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          const custData = custSnap.data() as Customer;
          
          // AI Logic
          let newTags = custData.ai_tags || [];
          if (!options.skipAi && getAiCooldownSeconds() === 0 && job.serviceNote) {
            try {
              const generated = await extractAiTags(job.serviceNote);
              newTags = Array.from(new Set([...newTags, ...generated])).slice(0, 10);
            } catch (e) { console.warn("AI skipped", e); }
          }

          await updateDoc(custRef, {
            is_returning: true, // Simplified: if completed job > 0, assume returning or check count
            last_service_date: job.serviceDate,
            last_service_summary: job.serviceItems.join(', '),
            ai_tags: newTags,
            updated_at: now
          });
        }
      }
      return jobToSave;
    },
    generateId: () => `JOB-${Date.now()}`
  },

  expenses: {
    getAll: async () => {
      const user = auth.getCurrentUser();
      if (user?.role === 'DECOY') return [];
      const q = query(collection(firestore, COLL.EXPENSES), where('deletedAt', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Expense);
      return user?.role === 'STAFF' ? list.map(e => deepMask(e)) : list;
    },
    save: async (expense: Expense) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.EXPENSES, expense.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await setDoc(ref, expense, { merge: true });
      } else {
        await setDoc(ref, expense);
      }
      logChange('EXPENSE', snap.exists() ? 'UPDATE' : 'CREATE', { entityType: 'Expense', entityId: expense.id }, `支出紀錄`);
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.EXPENSES, id);
      await updateDoc(ref, { deletedAt: new Date().toISOString() });
      logChange('EXPENSE', 'DELETE', { entityType: 'Expense', entityId: id }, `刪除支出`);
    },
    generateId: () => `EXP-${Date.now()}`
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const ref = doc(firestore, COLL.SETTINGS, 'global');
      const snap = await getDoc(ref);
      const def = {
        monthlyTarget: 150000,
        monthlySalary: 60000,
        laborBreakdown: { bossSalary: 30000, partnerSalary: 30000 },
        consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 }
      };
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        // Staff masking
        const user = auth.getCurrentUser();
        return user?.role === 'STAFF' ? deepMask(data) : { ...def, ...data };
      }
      return def;
    },
    save: async (settings: AppSettings) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.SETTINGS, 'global');
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;
      await setDoc(ref, settings, { merge: true });
      const diff = calculateDiff(before, settings);
      logChange('SETTINGS', 'UPDATE', { entityType: 'Settings', entityId: 'global' }, '更新系統參數', diff);
    }
  },

  l2: {
    assets: {
      getAll: async () => {
        const q = query(collection(firestore, COLL.L2_ASSETS), where('deletedAt', '==', null));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data() as L2Asset);
        const user = auth.getCurrentUser();
        return user?.role === 'STAFF' ? list.map(i => deepMask(i)) : list;
      },
      save: async (item: L2Asset) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_ASSETS, item.id);
        await setDoc(ref, item, { merge: true });
        logChange('SETTINGS', 'UPDATE', { entityType: 'Asset', entityId: item.id }, `資產: ${item.name}`);
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_ASSETS, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2A-${Date.now()}`
    },
    stock: {
      getAll: async () => {
        const q = query(collection(firestore, COLL.L2_STOCK), where('deletedAt', '==', null));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data() as L2StockLog);
        const user = auth.getCurrentUser();
        return user?.role === 'STAFF' ? list.map(i => deepMask(i)) : list;
      },
      save: async (item: L2StockLog) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_STOCK, item.id);
        await setDoc(ref, item, { merge: true });
        logChange('SETTINGS', 'UPDATE', { entityType: 'Stock', entityId: item.id }, `庫存進貨`);
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_STOCK, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: async (): Promise<L2LaborConfig> => {
        const ref = doc(firestore, COLL.SETTINGS, 'l2_labor');
        const snap = await getDoc(ref);
        const def = { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 };
        if (snap.exists()) {
           const data = snap.data() as L2LaborConfig;
           const user = auth.getCurrentUser();
           return user?.role === 'STAFF' ? deepMask(data) : { ...def, ...data };
        }
        return def;
      },
      save: async (cfg: L2LaborConfig) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.SETTINGS, 'l2_labor');
        await setDoc(ref, cfg, { merge: true });
        logChange('SETTINGS', 'UPDATE', { entityType: 'LaborConfig', entityId: 'L2' }, '更新人力成本參數');
      }
    }
  }
};

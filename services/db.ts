
import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig, AuditLog } from '../types';
import { db as firestore } from './firebase';
import { auth } from './auth';
import { AuditService } from './audit';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where, orderBy, limit } from "firebase/firestore";
import { extractAiTags, getAiCooldownSeconds } from './gemini';

// Collection Names
const COLL = {
  CUSTOMERS: 'customers',
  JOBS: 'jobs',
  EXPENSES: 'expenses',
  SETTINGS: 'settings',
  L2_ASSETS: 'l2_assets',
  L2_STOCK: 'l2_stock',
  AUDIT: 'audit_logs'
};

// Helper: Deep Masking for Staff View
const deepMask = (obj: any): any => {
  if (!obj) return obj;
  const user = auth.getCurrentUser();
  if (!user || user.role === 'BOSS' || user.role === 'MANAGER') return obj;
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

// Helper: Calculate Object Diff
const getDiff = (before: any, after: any) => {
  // Simple diff logic
  return { before, after };
};

export const db = {
  audit: {
    getAll: async () => {
      // Everyone can read audit logs (masked if staff)
      const q = query(collection(firestore, COLL.AUDIT), orderBy('ts', 'desc'), limit(50));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => {
        const data = d.data();
        // Convert timestamp to string for UI
        return { 
          id: d.id, 
          ...data, 
          createdAt: data.createdAt || (data.ts ? new Date(data.ts.seconds * 1000).toISOString() : '') 
        } as AuditLog;
      });
      
      const user = auth.getCurrentUser();
      // Mask audit details for staff? Maybe not strict requirement, but let's be safe
      return user?.role === 'STAFF' ? deepMask(logs) : logs;
    }
  },

  customers: {
    getAll: async () => {
      const q = query(collection(firestore, COLL.CUSTOMERS), where('deleted_at', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Customer);
      return list.map(c => deepMask(c));
    },
    get: async (id: string) => {
      const snap = await getDoc(doc(firestore, COLL.CUSTOMERS, id));
      if (!snap.exists()) return undefined;
      return deepMask(snap.data() as Customer);
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.CUSTOMERS, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const before = snap.data();
        await updateDoc(ref, { deleted_at: new Date().toISOString() });
        
        await AuditService.log({
          action: 'DELETE',
          module: 'CUSTOMER',
          entityId: id,
          entityName: before.displayName,
          summary: `刪除村民: ${before.displayName}`,
          before
        }, auth.getCurrentUser());
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
        // UPDATE
        const before = snap.data();
        await setDoc(ref, dataToSave, { merge: true });
        await AuditService.log({
          action: 'UPDATE',
          module: 'CUSTOMER',
          entityId: customer.customer_id,
          entityName: displayName,
          summary: `更新村民資料: ${displayName}`,
          before,
          after: dataToSave
        }, auth.getCurrentUser());
      } else {
        // CREATE
        dataToSave.created_at = now;
        await setDoc(ref, dataToSave);
        await AuditService.log({
          action: 'CREATE',
          module: 'CUSTOMER',
          entityId: customer.customer_id,
          entityName: displayName,
          summary: `新增村民: ${displayName}`,
          after: dataToSave
        }, auth.getCurrentUser());
      }
    },
    generateId: () => `C${Date.now().toString(36).toUpperCase()}`
  },

  jobs: {
    getAll: async () => {
      const q = query(collection(firestore, COLL.JOBS), where('deletedAt', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Job);
      return list.map(j => deepMask(j));
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.JOBS, id);
      const snap = await getDoc(ref);
      if(snap.exists()) {
        const before = snap.data();
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
        await AuditService.log({
          action: 'DELETE',
          module: 'JOB',
          entityId: id,
          entityName: before.contactPerson,
          summary: `刪除工單: ${before.serviceDate} ${before.contactPerson}`,
          before
        }, auth.getCurrentUser());
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
        await setDoc(ref, jobToSave, { merge: true });
        await AuditService.log({
          action: 'UPDATE',
          module: 'JOB',
          entityId: job.jobId,
          entityName: `${job.serviceDate} ${job.contactPerson}`,
          summary: `更新工單`,
          before,
          after: jobToSave
        }, auth.getCurrentUser());
      } else {
        jobToSave.createdAt = now;
        await setDoc(ref, jobToSave);
        await AuditService.log({
          action: 'CREATE',
          module: 'JOB',
          entityId: job.jobId,
          entityName: `${job.serviceDate} ${job.contactPerson}`,
          summary: `新增工單`,
          after: jobToSave
        }, auth.getCurrentUser());
      }

      // Sync logic (Auto-update Customer last service)
      if (job.status === JobStatus.COMPLETED) {
        try {
          const custRef = doc(firestore, COLL.CUSTOMERS, job.customerId);
          const custSnap = await getDoc(custRef);
          if (custSnap.exists()) {
            const custData = custSnap.data() as Customer;
            let newTags = custData.ai_tags || [];
            
            // AI Trigger
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
      return jobToSave;
    },
    generateId: () => `JOB-${Date.now()}`
  },

  expenses: {
    getAll: async () => {
      const q = query(collection(firestore, COLL.EXPENSES), where('deletedAt', '==', null));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data() as Expense);
      return list.map(e => deepMask(e));
    },
    save: async (expense: Expense) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.EXPENSES, expense.id);
      const snap = await getDoc(ref);
      
      if (snap.exists()) {
        const before = snap.data();
        await setDoc(ref, expense, { merge: true });
        await AuditService.log({
          action: 'UPDATE',
          module: 'EXPENSE',
          entityId: expense.id,
          summary: `更新支出: ${expense.amount}`,
          before, after: expense
        }, auth.getCurrentUser());
      } else {
        await setDoc(ref, expense);
        await AuditService.log({
          action: 'CREATE',
          module: 'EXPENSE',
          entityId: expense.id,
          summary: `新增支出: ${expense.category} $${expense.amount}`,
          after: expense
        }, auth.getCurrentUser());
      }
    },
    delete: async (id: string) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.EXPENSES, id);
      const snap = await getDoc(ref);
      if(snap.exists()) {
        const before = snap.data();
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
        await AuditService.log({
          action: 'DELETE',
          module: 'EXPENSE',
          entityId: id,
          summary: `刪除支出`,
          before
        }, auth.getCurrentUser());
      }
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
        return deepMask({ ...def, ...data });
      }
      return def;
    },
    save: async (settings: AppSettings) => {
      if (!auth.canWrite()) return;
      const ref = doc(firestore, COLL.SETTINGS, 'global');
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;
      
      await setDoc(ref, settings, { merge: true });
      await AuditService.log({
        action: 'UPDATE',
        module: 'SETTINGS',
        entityId: 'global',
        summary: '更新系統參數',
        before, after: settings
      }, auth.getCurrentUser());
    }
  },

  l2: {
    assets: {
      getAll: async () => {
        const q = query(collection(firestore, COLL.L2_ASSETS), where('deletedAt', '==', null));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data() as L2Asset);
        return list.map(i => deepMask(i));
      },
      save: async (item: L2Asset) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_ASSETS, item.id);
        const snap = await getDoc(ref);
        const before = snap.exists() ? snap.data() : null;
        
        await setDoc(ref, item, { merge: true });
        await AuditService.log({
          action: snap.exists() ? 'UPDATE' : 'CREATE',
          module: 'SETTINGS',
          entityId: item.id,
          summary: `資產: ${item.name}`,
          before, after: item
        }, auth.getCurrentUser());
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_ASSETS, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
        await AuditService.log({
            action: 'DELETE',
            module: 'SETTINGS',
            entityId: id,
            summary: `刪除資產`
        }, auth.getCurrentUser());
      },
      generateId: () => `L2A-${Date.now()}`
    },
    stock: {
      getAll: async () => {
        const q = query(collection(firestore, COLL.L2_STOCK), where('deletedAt', '==', null));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data() as L2StockLog);
        return list.map(i => deepMask(i));
      },
      save: async (item: L2StockLog) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_STOCK, item.id);
        const snap = await getDoc(ref);
        const before = snap.exists() ? snap.data() : null;

        await setDoc(ref, item, { merge: true });
        await AuditService.log({
          action: snap.exists() ? 'UPDATE' : 'CREATE',
          module: 'SETTINGS',
          entityId: item.id,
          summary: `庫存進貨: ${item.itemType}`,
          before, after: item
        }, auth.getCurrentUser());
      },
      delete: async (id: string) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.L2_STOCK, id);
        await updateDoc(ref, { deletedAt: new Date().toISOString() });
        await AuditService.log({
            action: 'DELETE',
            module: 'SETTINGS',
            entityId: id,
            summary: `刪除庫存紀錄`
        }, auth.getCurrentUser());
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: async (): Promise<L2LaborConfig> => {
        const ref = doc(firestore, COLL.SETTINGS, 'l2_labor');
        const snap = await getDoc(ref);
        const def = { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 };
        if (snap.exists()) {
           return deepMask({ ...def, ...snap.data() });
        }
        return def;
      },
      save: async (cfg: L2LaborConfig) => {
        if (!auth.canWrite()) return;
        const ref = doc(firestore, COLL.SETTINGS, 'l2_labor');
        const snap = await getDoc(ref);
        const before = snap.exists() ? snap.data() : null;
        
        await setDoc(ref, cfg, { merge: true });
        await AuditService.log({
          action: 'UPDATE',
          module: 'SETTINGS',
          entityId: 'L2_LABOR',
          summary: '更新人力成本參數',
          before, after: cfg
        }, auth.getCurrentUser());
      }
    }
  }
};

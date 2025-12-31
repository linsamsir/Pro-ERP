
import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig, AuditLog } from '../types';
import { db as firestore } from './firebase';
import { auth } from './auth';
import { AuditService } from './audit';
import { COLLECTIONS } from './firestorePaths';
import { 
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, 
  query, where, orderBy, limit, startAfter, getCountFromServer,
  runTransaction,
  QueryConstraint, QueryDocumentSnapshot 
} from "firebase/firestore";
import { parseRegion } from '../data/territory';

// --- Helpers ---
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

const handleDbError = (context: string, error: any) => {
  console.error(`[Firestore Error] ${context}:`, error);
  if (error.code === 'failed-precondition' || error.message?.includes('index')) {
    throw new Error("系統索引建立中（Firestore Index Required），請點擊錯誤訊息中的連結建立索引，或稍候再試。");
  }
  throw error;
};

export const db = {
  // 1. Customers
  customers: {
    generateId: () => `CUST-${Date.now()}`,

    previewNextId: async () => {
      const ref = doc(firestore, COLLECTIONS.COUNTERS, 'customers');
      const snap = await getDoc(ref);
      const next = (snap.data()?.count || 0) + 1;
      return `C${String(next).padStart(4, '0')}`;
    },

    createWithAutoId: async (c: Partial<Customer>) => {
      const now = new Date().toISOString();
      let customer_id = '';
      const docRef = doc(collection(firestore, COLLECTIONS.CUSTOMERS));
      
      // 解析地區以便未來索引
      const addrStr = c.addresses?.find(a => a.isPrimary)?.text || c.addresses?.[0]?.text || '';
      const { city, district } = parseRegion(addrStr);

      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, COLLECTIONS.COUNTERS, 'customers');
        const counterSnap = await transaction.get(counterRef);
        const nextCount = (counterSnap.data()?.count || 0) + 1;
        customer_id = `C${String(nextCount).padStart(4, '0')}`;
        
        transaction.set(counterRef, { count: nextCount });
        const payload = { 
          ...c, 
          customer_id,
          city, // 寫入獨立欄位
          district, // 寫入獨立欄位
          updated_at: now, 
          created_at: now,
          is_returning: c.is_returning || false,
          ai_tags: c.ai_tags || [],
          avatar: c.avatar || 'man'
        };
        delete (payload as any).docId;
        transaction.set(docRef, payload);
      });

      return { ...c, customer_id, docId: docRef.id, city, district } as Customer;
    },

    getTotalCount: async () => {
      const coll = collection(firestore, COLLECTIONS.CUSTOMERS);
      const snapshot = await getCountFromServer(query(coll));
      return snapshot.data().count;
    },

    getCustomersPage: async (params: { city?: string, district?: string, lastDoc?: QueryDocumentSnapshot, limitSize?: number }) => {
      try {
        const { city, district, lastDoc, limitSize = 50 } = params;
        const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
        
        // 修正策略：如果指定了「非高雄」的城市，抓取緩衝區應調大，
        // 因為高雄佔多數，若緩衝區太小會導致台南屏東第一頁看起來沒資料
        const effectiveLimit = (city && city !== '全部' && city !== '高雄市') ? 1000 : limitSize;

        const constraints: QueryConstraint[] = [
          orderBy('updated_at', 'desc'),
          limit(effectiveLimit)
        ];

        if (lastDoc) constraints.push(startAfter(lastDoc));

        const q = query(ref, ...constraints);
        const snap = await getDocs(q);
        
        let items = snap.docs.map(d => ({ 
          ...d.data(), 
          docId: d.id, 
          customer_id: d.data().customer_id || d.id 
        } as Customer));
        
        // 前端過濾
        items = items.filter(c => !c.deleted_at);

        if (city && city !== '全部') {
          items = items.filter(c => {
            // 優雅降級：優先讀取儲存的欄位，沒有則動態解析
            const cCity = (c as any).city || parseRegion(c.addresses?.find(a => a.isPrimary)?.text || '').city;
            const cDist = (c as any).district || parseRegion(c.addresses?.find(a => a.isPrimary)?.text || '').district;
            
            if (district && district !== '全部') {
               return cCity === city && cDist === district;
            }
            return cCity === city;
          });
        }

        // 如果過濾後太少，且還有更多原始資料，則回傳時告知 hasMore
        // 注意：這裡的分頁邏輯在 client-side filter 下是複雜的，先以加大 limit 為主
        return {
          items: items.map(c => deepMask(c)),
          lastDoc: snap.docs[snap.docs.length - 1],
          hasMore: snap.docs.length >= effectiveLimit
        };
      } catch (e) {
        return handleDbError('getCustomersPage', e);
      }
    },

    list: async () => {
       const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
       // [FIX] 移除 limit(500) 限制，讓地圖能載入所有村民 (目前 1117 人)
       // 為確保效能，設定一個較大的上限如 5000，而非 500
       const snap = await getDocs(query(ref, orderBy('updated_at', 'desc'), limit(5000)));
       return snap.docs
         .map(d => ({ ...d.data(), docId: d.id } as Customer))
         .filter(c => !c.deleted_at)
         .map(c => deepMask(c));
    },

    getAll: async () => db.customers.list(),

    get: async (id: string) => {
      if (!id) return undefined;
      const docRef = doc(firestore, COLLECTIONS.CUSTOMERS, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) return deepMask({ ...snap.data(), docId: snap.id } as Customer);
      const q = query(collection(firestore, COLLECTIONS.CUSTOMERS), where('customer_id', '==', id), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) return deepMask({ ...qSnap.docs[0].data(), docId: qSnap.docs[0].id } as Customer);
      return undefined;
    },

    save: async (c: Customer) => {
      const now = new Date().toISOString();
      const addrStr = c.addresses?.find(a => a.isPrimary)?.text || c.addresses?.[0]?.text || '';
      const { city, district } = parseRegion(addrStr);
      
      const payload = { 
        ...c, 
        city, // 儲存時自動正規化地區
        district,
        updated_at: now 
      };
      
      delete (payload as any).docId;
      if (c.docId) {
        await updateDoc(doc(firestore, COLLECTIONS.CUSTOMERS, c.docId), payload);
        return { ...payload, docId: c.docId };
      } else {
        const ref = await addDoc(collection(firestore, COLLECTIONS.CUSTOMERS), payload);
        return { ...payload, docId: ref.id };
      }
    }
  },

  // 2. Jobs
  jobs: {
    generateId: () => `JOB-${Date.now()}`,
    delete: async (id: string) => {
      await updateDoc(doc(firestore, COLLECTIONS.JOBS, id), { deletedAt: new Date().toISOString() });
    },
    getJobsPage: async (params: { 
      city?: string,
      district?: string,
      lastDoc?: QueryDocumentSnapshot, 
      limitSize?: number,
      days?: number
    }) => {
      try {
        const { lastDoc, limitSize = 50, days = 60 } = params;
        const ref = collection(firestore, COLLECTIONS.JOBS);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toLocaleDateString('en-CA');

        const constraints: QueryConstraint[] = [
          where('serviceDate', '>=', cutoffStr),
          orderBy('serviceDate', 'desc'),
          limit(limitSize)
        ];

        if (lastDoc) constraints.push(startAfter(lastDoc));

        const q = query(ref, ...constraints);
        const snap = await getDocs(q);
        
        let items = snap.docs
          .map(d => ({ ...d.data(), jobId: d.id } as Job))
          .filter(j => !j.deletedAt);

        return {
          items: items.map(j => deepMask(j)),
          lastDoc: snap.docs[snap.docs.length - 1],
          hasMore: snap.docs.length >= limitSize
        };
      } catch (e) {
        return handleDbError('getJobsPage', e);
      }
    },
    list: async (params: { startDate?: string, endDate?: string, customerId?: string } = {}) => {
      const ref = collection(firestore, COLLECTIONS.JOBS);
      let constraints: QueryConstraint[] = [orderBy('serviceDate', 'desc')];
      if (params.startDate) constraints.push(where('serviceDate', '>=', params.startDate));
      if (params.endDate) constraints.push(where('serviceDate', '<=', params.endDate));
      // [FIX] Create the query object 'q' using the constraints
      const q = query(ref, ...constraints);
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ ...d.data(), jobId: d.id } as Job)).filter(j => !j.deletedAt);
      if (params.customerId) list = list.filter(j => j.customerId === params.customerId);
      return list.map(j => deepMask(j));
    },
    getAll: async () => db.jobs.list(),
    save: async (job: Job, _config?: { skipAi?: boolean }) => {
      const ref = doc(firestore, COLLECTIONS.JOBS, job.jobId);
      const now = new Date().toISOString();
      const payload = { ...job, updatedAt: now };
      await setDoc(ref, payload, { merge: true });
      return payload;
    }
  },

  dashboard: {
    getSummary: async (startDate: string, endDate: string) => {
      const jobs = await db.jobs.list({ startDate, endDate });
      const expenses = await db.expenses.list({ startDate, endDate });
      const revenue = jobs.reduce((sum, j) => {
        const val = j.financial?.total_amount ?? j.totalPaid ?? 0;
        return sum + (typeof val === 'number' ? val : parseInt(val) || 0);
      }, 0);
      const cost = expenses.filter(e => !e.cashflowOnly).reduce((sum, e) => sum + (e.amount || 0), 0);
      return { 
        revenue, 
        cost, 
        netProfit: revenue - cost, 
        jobCount: jobs.length, 
        expenseCount: expenses.length, 
        recentJobs: jobs.slice(0, 50), 
        recentExpenses: expenses.slice(0, 50) 
      };
    }
  },

  expenses: {
    list: async (params: { startDate?: string, endDate?: string } = {}) => {
      const ref = collection(firestore, COLLECTIONS.EXPENSES);
      let constraints: QueryConstraint[] = [orderBy('date', 'desc')];
      if (params.startDate) constraints.push(where('date', '>=', params.startDate));
      if (params.endDate) constraints.push(where('date', '<=', params.endDate));
      const snap = await getDocs(query(ref, ...constraints));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense)).filter(e => !e.deletedAt).map(e => deepMask(e));
    },
    getAll: async () => db.expenses.list(),
    save: async (expense: Expense) => {
      const ref = doc(firestore, COLLECTIONS.EXPENSES, expense.id);
      await setDoc(ref, expense, { merge: true });
    },
    delete: async (id: string) => {
      await updateDoc(doc(firestore, COLLECTIONS.EXPENSES, id), { deletedAt: new Date().toISOString() });
    },
    generateId: () => `EXP-${Date.now()}`
  },

  audit: {
    getAll: async () => {
      const q = query(collection(firestore, COLLECTIONS.AUDIT_LOGS), orderBy('ts', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, 'global'));
      return snap.exists() ? snap.data() as AppSettings : { monthlyTarget: 150000, monthlySalary: 60000, consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 } };
    },
    save: async (s: AppSettings) => {
      await setDoc(doc(firestore, COLLECTIONS.SETTINGS, 'global'), s, { merge: true });
    }
  },

  l2: {
    assets: {
      getAll: async () => {
        const snap = await getDocs(collection(firestore, COLLECTIONS.L2_ASSETS));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as L2Asset)).filter(i => !i.deletedAt).map(i => deepMask(i));
      },
      save: async (item: L2Asset) => {
        await setDoc(doc(firestore, COLLECTIONS.L2_ASSETS, item.id), item, { merge: true });
      },
      delete: async (id: string) => {
        await updateDoc(doc(firestore, COLLECTIONS.L2_ASSETS, id), { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2A-${Date.now()}`
    },
    stock: {
      getAll: async () => {
        const snap = await getDocs(collection(firestore, COLLECTIONS.L2_STOCK));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as L2StockLog)).filter(i => !i.deletedAt).map(i => deepMask(i));
      },
      save: async (item: L2StockLog) => {
        await setDoc(doc(firestore, COLLECTIONS.L2_STOCK, item.id), item, { merge: true });
      },
      delete: async (id: string) => {
        await updateDoc(doc(firestore, COLLECTIONS.L2_STOCK, id), { deletedAt: new Date().toISOString() });
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: async (): Promise<L2LaborConfig> => {
        const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor'));
        return snap.exists() ? snap.data() as L2LaborConfig : { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 };
      },
      save: async (cfg: L2LaborConfig) => {
        await setDoc(doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor'), cfg, { merge: true });
      }
    }
  }
};

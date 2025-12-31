
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
  if (!user) return obj; 
  if (user.role === 'BOSS' || user.role === 'MANAGER') return obj;
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
  if (error.code === 'permission-denied') {
    throw new Error("存取權限不足。請聯繫管理員確認權限。");
  }
  throw error;
};

/** 
 * 格式化 ID 為 C + 7位數字 (例如 C0001125)
 */
const formatCustomerId = (num: number) => `C${String(num).padStart(7, '0')}`;

/**
 * 核心邏輯：從現有村民名冊中找出最高編號
 * 改良版：增加範圍過濾與採樣機制，解決字串排序與索引問題
 */
const findMaxIdInDb = async (): Promise<number> => {
  try {
    const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
    
    // 1. 嘗試精確範圍查詢 (需要索引)
    // 限定在 C0000000 ~ C9999999 之間，排除 C123 或 CUST-123 的干擾
    const q = query(
      ref, 
      where('customer_id', '>=', 'C0000000'),
      where('customer_id', '<=', 'C9999999'),
      orderBy('customer_id', 'desc'), 
      limit(1)
    );
    
    let snap;
    try {
      snap = await getDocs(q);
    } catch (indexError) {
      // 2. 如果索引尚未建立 (Index building)，使用更新時間採樣最近 100 筆
      console.warn("[DB] 精確排序索引尚未就緒，改用採樣模式...");
      const fallbackQ = query(ref, orderBy('updated_at', 'desc'), limit(100));
      snap = await getDocs(fallbackQ);
    }

    if (snap.empty) return 0;
    
    // 從回傳結果中找數字最大的 (採樣模式下可能不止一筆)
    let maxNum = 0;
    snap.docs.forEach(d => {
      const cid = d.data().customer_id || '';
      const match = cid.match(/\d+/);
      if (match) {
        const val = parseInt(match[0]);
        if (val > maxNum) maxNum = val;
      }
    });
    
    return maxNum;
  } catch (e) {
    console.error("[DB] 檢索最大 ID 時發生錯誤:", e);
    return 0;
  }
};

export const db = {
  customers: {
    generateId: () => `CUST-${Date.now()}`,

    /** 預覽下一個建議編號：強制即時核對名冊，不依賴可能不同步的 Counter */
    previewNextId: async () => {
      try {
        // 同時檢查 Counter 與 實體名冊
        const counterRef = doc(firestore, COLLECTIONS.COUNTERS, 'customers');
        const counterSnap = await getDoc(counterRef);
        const counterVal = counterSnap.exists() ? (counterSnap.data()?.count || 0) : 0;

        const dbMax = await findMaxIdInDb();
        
        // 絕對值：取兩者較大者 + 1
        const nextNum = Math.max(counterVal, dbMax) + 1;
        
        console.log(`[ID Gen] Counter: ${counterVal}, DB Max: ${dbMax} -> Suggested: ${nextNum}`);
        return formatCustomerId(nextNum);
      } catch (e) {
        const dbMax = await findMaxIdInDb();
        return formatCustomerId(dbMax + 1);
      }
    },

    createWithAutoId: async (c: Partial<Customer>) => {
      const now = new Date().toISOString();
      const docRef = doc(collection(firestore, COLLECTIONS.CUSTOMERS));
      const addrStr = c.addresses?.find(a => a.isPrimary)?.text || c.addresses?.[0]?.text || '';
      const { city, district } = parseRegion(addrStr);

      let finalId = '';

      try {
        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, COLLECTIONS.COUNTERS, 'customers');
          const counterSnap = await transaction.get(counterRef);
          let currentCount = counterSnap.exists() ? (counterSnap.data()?.count || 0) : 0;
          
          // 交易內再次確認絕對最大值，防止多人同時寫入或索引延遲
          const dbMax = await findMaxIdInDb();
          const nextCount = Math.max(currentCount, dbMax) + 1;
          
          finalId = formatCustomerId(nextCount);
          
          transaction.set(counterRef, { count: nextCount }, { merge: true });
          
          const payload = { 
            ...c, 
            customer_id: finalId,
            city, district,
            updated_at: now, created_at: now,
            is_returning: c.is_returning || false,
            ai_tags: c.ai_tags || [],
            avatar: c.avatar || 'man'
          };
          delete (payload as any).docId;
          transaction.set(docRef, payload);
        });
      } catch (e: any) {
        console.warn("[DB] 自動編號交易失敗，切換至暴力補號模式:", e.message);
        // 如果連交易都失敗，手動計算並寫入（雖然非原子性但能保證編號至少是遞增的）
        finalId = await db.customers.previewNextId();
        const payload = { 
          ...c, 
          customer_id: finalId,
          city, district,
          updated_at: now, created_at: now,
          is_returning: c.is_returning || false,
          ai_tags: c.ai_tags || [],
          avatar: c.avatar || 'man'
        };
        delete (payload as any).docId;
        await setDoc(docRef, payload);
      }

      return { ...c, customer_id: finalId, docId: docRef.id, city, district } as Customer;
    },

    getTotalCount: async () => {
      try {
        const coll = collection(firestore, COLLECTIONS.CUSTOMERS);
        const snapshot = await getCountFromServer(query(coll));
        return snapshot.data().count;
      } catch (e: any) {
        return 0;
      }
    },

    getCustomersPage: async (params: { city?: string, district?: string, lastDoc?: QueryDocumentSnapshot, limitSize?: number }) => {
      try {
        const { city, district, lastDoc, limitSize = 50 } = params;
        const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
        const effectiveLimit = (city && city !== '全部' && city !== '高雄市') ? 1000 : limitSize;
        const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc'), limit(effectiveLimit)];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const q = query(ref, ...constraints);
        const snap = await getDocs(q);
        let items = snap.docs.map(d => ({ ...d.data(), docId: d.id, customer_id: d.data().customer_id || d.id } as Customer));
        items = items.filter(c => !c.deleted_at);
        if (city && city !== '全部') {
          items = items.filter(c => {
            const cCity = (c as any).city || parseRegion(c.addresses?.find(a => a.isPrimary)?.text || '').city;
            const cDist = (c as any).district || parseRegion(c.addresses?.find(a => a.isPrimary)?.text || '').district;
            if (district && district !== '全部') return cCity === city && cDist === district;
            return cCity === city;
          });
        }
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
       try {
         const ref = collection(firestore, COLLECTIONS.CUSTOMERS);
         const snap = await getDocs(query(ref, orderBy('updated_at', 'desc'), limit(5000)));
         return snap.docs
           .map(d => ({ ...d.data(), docId: d.id } as Customer))
           .filter(c => !c.deleted_at)
           .map(c => deepMask(c));
       } catch (e) {
         return handleDbError('customers.list', e);
       }
    },

    getAll: async () => db.customers.list(),

    get: async (id: string) => {
      try {
        if (!id) return undefined;
        const docRef = doc(firestore, COLLECTIONS.CUSTOMERS, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) return deepMask({ ...snap.data(), docId: snap.id } as Customer);
        const q = query(collection(firestore, COLLECTIONS.CUSTOMERS), where('customer_id', '==', id), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) return deepMask({ ...qSnap.docs[0].data(), docId: qSnap.docs[0].id } as Customer);
        return undefined;
      } catch (e) {
        return handleDbError('customers.get', e);
      }
    },

    save: async (c: Customer) => {
      try {
        const now = new Date().toISOString();
        const addrStr = c.addresses?.find(a => a.isPrimary)?.text || c.addresses?.[0]?.text || '';
        const { city, district } = parseRegion(addrStr);
        const payload = { ...c, city, district, updated_at: now };
        delete (payload as any).docId;
        if (c.docId) {
          await updateDoc(doc(firestore, COLLECTIONS.CUSTOMERS, c.docId), payload);
          return { ...payload, docId: c.docId };
        } else {
          const ref = await addDoc(collection(firestore, COLLECTIONS.CUSTOMERS), payload);
          return { ...payload, docId: ref.id };
        }
      } catch (e) {
        return handleDbError('customers.save', e);
      }
    }
  },

  jobs: {
    generateId: () => `JOB-${Date.now()}`,
    delete: async (id: string) => {
      try {
        await updateDoc(doc(firestore, COLLECTIONS.JOBS, id), { deletedAt: new Date().toISOString() });
      } catch (e) {
        handleDbError('jobs.delete', e);
      }
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
        const constraints: QueryConstraint[] = [where('serviceDate', '>=', cutoffStr), orderBy('serviceDate', 'desc'), limit(limitSize)];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const q = query(ref, ...constraints);
        const snap = await getDocs(q);
        let items = snap.docs.map(d => ({ ...d.data(), jobId: d.id } as Job)).filter(j => !j.deletedAt);
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
      try {
        const ref = collection(firestore, COLLECTIONS.JOBS);
        let constraints: QueryConstraint[] = [orderBy('serviceDate', 'desc')];
        if (params.startDate) constraints.push(where('serviceDate', '>=', params.startDate));
        if (params.endDate) constraints.push(where('serviceDate', '<=', params.endDate));
        const q = query(ref, ...constraints);
        const snap = await getDocs(q);
        let list = snap.docs.map(d => ({ ...d.data(), jobId: d.id } as Job)).filter(j => !j.deletedAt);
        if (params.customerId) list = list.filter(j => j.customerId === params.customerId);
        return list.map(j => deepMask(j));
      } catch (e) {
        return handleDbError('jobs.list', e);
      }
    },
    getAll: async () => db.jobs.list(),
    save: async (job: Job, _config?: { skipAi?: boolean }) => {
      try {
        const ref = doc(firestore, COLLECTIONS.JOBS, job.jobId);
        const now = new Date().toISOString();
        const payload = { ...job, updatedAt: now };
        await setDoc(ref, payload, { merge: true });
        return payload;
      } catch (e) {
        return handleDbError('jobs.save', e);
      }
    }
  },

  dashboard: {
    getSummary: async (startDate: string, endDate: string) => {
      try {
        const jobs = await db.jobs.list({ startDate, endDate });
        const expenses = await db.expenses.list({ startDate, endDate });
        const revenue = jobs.reduce((sum, j) => {
          const val = j.financial?.total_amount ?? j.totalPaid ?? 0;
          return sum + (typeof val === 'number' ? val : parseInt(val) || 0);
        }, 0);
        const cost = expenses.filter(e => !e.cashflowOnly).reduce((sum, e) => sum + (e.amount || 0), 0);
        return { 
          revenue, cost, netProfit: revenue - cost, 
          jobCount: jobs.length, expenseCount: expenses.length, 
          recentJobs: jobs.slice(0, 50), recentExpenses: expenses.slice(0, 50) 
        };
      } catch (e) {
        return handleDbError('dashboard.getSummary', e);
      }
    }
  },

  expenses: {
    list: async (params: { startDate?: string, endDate?: string } = {}) => {
      try {
        const ref = collection(firestore, COLLECTIONS.EXPENSES);
        let constraints: QueryConstraint[] = [orderBy('date', 'desc')];
        if (params.startDate) constraints.push(where('date', '>=', params.startDate));
        if (params.endDate) constraints.push(where('date', '<=', params.endDate));
        const snap = await getDocs(query(ref, ...constraints));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense)).filter(e => !e.deletedAt).map(e => deepMask(e));
      } catch (e) {
        return handleDbError('expenses.list', e);
      }
    },
    getAll: async () => db.expenses.list(),
    save: async (expense: Expense) => {
      try {
        const ref = doc(firestore, COLLECTIONS.EXPENSES, expense.id);
        await setDoc(ref, expense, { merge: true });
      } catch (e) {
        handleDbError('expenses.save', e);
      }
    },
    delete: async (id: string) => {
      try {
        await updateDoc(doc(firestore, COLLECTIONS.EXPENSES, id), { deletedAt: new Date().toISOString() });
      } catch (e) {
        handleDbError('expenses.delete', e);
      }
    },
    generateId: () => `EXP-${Date.now()}`
  },

  audit: {
    getAll: async () => {
      try {
        const q = query(collection(firestore, COLLECTIONS.AUDIT_LOGS), orderBy('ts', 'desc'), limit(100));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
      } catch (e) {
        return [];
      }
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      try {
        const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, 'global'));
        return snap.exists() ? snap.data() as AppSettings : { monthlyTarget: 150000, monthlySalary: 60000, consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 } };
      } catch (e) {
        return { monthlyTarget: 150000, monthlySalary: 60000, consumables: { citricCostPerCan: 50, chemicalDrumCost: 3000, chemicalDrumToBottles: 20 } };
      }
    },
    save: async (s: AppSettings) => {
      try {
        await setDoc(doc(firestore, COLLECTIONS.SETTINGS, 'global'), s, { merge: true });
      } catch (e) {
        handleDbError('settings.save', e);
      }
    }
  },

  l2: {
    assets: {
      getAll: async () => {
        try {
          const snap = await getDocs(collection(firestore, COLLECTIONS.L2_ASSETS));
          return snap.docs.map(d => ({ ...d.data(), id: d.id } as L2Asset)).filter(i => !i.deletedAt).map(i => deepMask(i));
        } catch (e) { return []; }
      },
      save: async (item: L2Asset) => {
        try { await setDoc(doc(firestore, COLLECTIONS.L2_ASSETS, item.id), item, { merge: true }); }
        catch (e) { handleDbError('assets.save', e); }
      },
      delete: async (id: string) => {
        try { await updateDoc(doc(firestore, COLLECTIONS.L2_ASSETS, id), { deletedAt: new Date().toISOString() }); }
        catch (e) { handleDbError('assets.delete', e); }
      },
      generateId: () => `L2A-${Date.now()}`
    },
    stock: {
      getAll: async () => {
        try {
          const snap = await getDocs(collection(firestore, COLLECTIONS.L2_STOCK));
          return snap.docs.map(d => ({ ...d.data(), id: d.id } as L2StockLog)).filter(i => !i.deletedAt).map(i => deepMask(i));
        } catch (e) { return []; }
      },
      save: async (item: L2StockLog) => {
        try { await setDoc(doc(firestore, COLLECTIONS.L2_STOCK, item.id), item, { merge: true }); }
        catch (e) { handleDbError('stock.save', e); }
      },
      delete: async (id: string) => {
        try { await updateDoc(doc(firestore, COLLECTIONS.L2_STOCK, id), { deletedAt: new Date().toISOString() }); }
        catch (e) { handleDbError('stock.delete', e); }
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: async (): Promise<L2LaborConfig> => {
        try {
          const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor'));
          return snap.exists() ? snap.data() as L2LaborConfig : { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 };
        } catch (e) { return { bossSalary: 40000, partnerSalary: 35000, insuranceCost: 12000 }; }
      },
      save: async (cfg: L2LaborConfig) => {
        try { await setDoc(doc(firestore, COLLECTIONS.SETTINGS, 'l2_labor'), cfg, { merge: true }); }
        catch (e) { handleDbError('labor.save', e); }
      }
    }
  }
};


import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig, User, AuditLog, UserRole } from '../types';
import { extractAiTags, getAiCooldownSeconds } from './gemini';

const STORAGE_KEYS = {
  CUSTOMERS: 'erp_customers_v3',
  JOBS: 'erp_jobs_v3',
  EXPENSES: 'erp_expenses_v1',
  SETTINGS: 'erp_settings_v1',
  L2_ASSETS: 'erp_l2_assets',
  L2_STOCK: 'erp_l2_stock',
  L2_LABOR: 'erp_l2_labor',
  USERS: 'erp_users_v1',
  AUDIT_LOGS: 'erp_audit_logs_v1'
};

const getStorage = <T,>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveStorage = <T,>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Helper to get current user for logging (without importing auth to avoid cycle if possible, but reading LS is safe) ---
const getCurrentActor = () => {
  try {
    const session = localStorage.getItem('erp_session_v1');
    if (session) return JSON.parse(session) as User;
  } catch {}
  return { id: 'sys', name: 'System', role: 'OWNER' as UserRole }; // Fallback
};

const createAuditLog = (
  module: AuditLog['module'],
  action: AuditLog['action'],
  target: AuditLog['target'],
  summary: string,
  diff?: AuditLog['diff']
) => {
  const actor = getCurrentActor();
  const logs = getStorage<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
  
  const newLog: AuditLog = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    actor: {
      userId: actor.id,
      name: actor.name,
      role: actor.role
    },
    module,
    action,
    target,
    summary,
    diff
  };
  
  // Keep logs reasonable size (e.g., last 2000)
  if (logs.length > 2000) logs.shift();
  logs.push(newLog);
  saveStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
};

const DEFAULT_SETTINGS: AppSettings = {
  monthlyTarget: 150000,
  monthlySalary: 60000,
  laborBreakdown: { bossSalary: 30000, partnerSalary: 30000 },
  consumables: {
    citricCostPerCan: 50,
    chemicalDrumCost: 3000,
    chemicalDrumToBottles: 20
  }
};

const DEFAULT_L2_LABOR: L2LaborConfig = {
  bossSalary: 40000,
  partnerSalary: 35000,
  insuranceCost: 12000
};

export const db = {
  users: {
    getAll: () => getStorage<User>(STORAGE_KEYS.USERS),
    init: () => {
      const users = getStorage<User>(STORAGE_KEYS.USERS);
      if (users.length === 0) {
        // Initialize Default Users
        // Password "admin" -> HASH_YWRtaW4=
        // Password "staff" -> HASH_c3RhZmY=
        const defaults: User[] = [
          { id: 'u1', username: 'admin', name: '老闆', role: 'OWNER', passwordHash: 'HASH_YWRtaW4=' },
          { id: 'u2', username: 'staff', name: '夥伴', role: 'STAFF', passwordHash: 'HASH_c3RhZmY=' }
        ];
        saveStorage(STORAGE_KEYS.USERS, defaults);
      }
    }
  },
  audit: {
    getAll: () => getStorage<AuditLog>(STORAGE_KEYS.AUDIT_LOGS),
    log: (actor: User, module: any, action: any, target: any, summary: string, diff?: any) => {
        // Manual log entry access
        const logs = getStorage<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
        logs.push({
            id: `LOG-${Date.now()}`,
            createdAt: new Date().toISOString(),
            actor: { userId: actor.id, name: actor.name, role: actor.role },
            module, action, target, summary, diff
        });
        saveStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
    }
  },
  customers: {
    getAll: () => getStorage<Customer>(STORAGE_KEYS.CUSTOMERS).filter(c => !c.deleted_at),
    get: (id: string) => getStorage<Customer>(STORAGE_KEYS.CUSTOMERS).find(c => c.customer_id === id && !c.deleted_at),
    delete: (id: string) => {
      const all = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
      const target = all.find(c => c.customer_id === id);
      if (target) {
        target.deleted_at = new Date().toISOString();
        saveStorage(STORAGE_KEYS.CUSTOMERS, all);
        createAuditLog('CUSTOMER', 'DELETE', { entityType: 'Customer', entityId: id, entityName: target.displayName }, `刪除村民: ${target.displayName}`);
      }
    },
    save: (customer: Customer) => {
      const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
      const index = customers.findIndex(c => c.customer_id === customer.customer_id);
      const now = new Date().toISOString();
      
      const displayName = customer.customerType === '公司'
        ? `${customer.companyName || ''} ${customer.contactName}`.trim()
        : customer.contactName;

      const updatedCustomer = { ...customer, displayName, updated_at: now };
      
      let action: 'CREATE' | 'UPDATE' = 'CREATE';
      let diff = {};

      if (index >= 0) {
        action = 'UPDATE';
        const before = customers[index];
        diff = { before, after: updatedCustomer };
        customers[index] = updatedCustomer;
      } else {
        updatedCustomer.created_at = now;
        customers.push(updatedCustomer);
        diff = { after: updatedCustomer };
      }
      
      saveStorage(STORAGE_KEYS.CUSTOMERS, customers);
      createAuditLog('CUSTOMER', action, { entityType: 'Customer', entityId: updatedCustomer.customer_id, entityName: updatedCustomer.displayName }, `${action === 'CREATE' ? '新增' : '更新'}村民資料`, diff);
    },
    generateId: () => {
      const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS); // Look at all including deleted for ID safety
      const lastId = customers.length > 0 
        ? [...customers].sort((a,b) => b.customer_id.localeCompare(a.customer_id))[0].customer_id 
        : 'C0000000';
      const num = parseInt(lastId.substring(1)) + 1;
      return `C${String(num).padStart(7, '0')}`;
    }
  },
  jobs: {
    getAll: () => getStorage<Job>(STORAGE_KEYS.JOBS).filter(j => !j.deletedAt),
    get: (id: string) => getStorage<Job>(STORAGE_KEYS.JOBS).find(j => j.jobId === id && !j.deletedAt),
    delete: (id: string) => {
      const all = getStorage<Job>(STORAGE_KEYS.JOBS);
      const target = all.find(j => j.jobId === id);
      if (target) {
        target.deletedAt = new Date().toISOString();
        saveStorage(STORAGE_KEYS.JOBS, all);
        createAuditLog('JOB', 'DELETE', { entityType: 'Job', entityId: id, entityName: target.contactPerson }, `刪除工單: ${target.serviceDate} ${target.contactPerson}`);
      }
    },
    save: async (job: Job, options: { skipAi?: boolean } = {}) => {
      const jobs = getStorage<Job>(STORAGE_KEYS.JOBS);
      const index = jobs.findIndex(j => j.jobId === job.jobId);
      const now = new Date().toISOString();
      
      const jobToSave = { ...job, updatedAt: now };
      let action: 'CREATE' | 'UPDATE' = 'CREATE';
      let diff = {};

      if (index >= 0) {
        action = 'UPDATE';
        diff = { before: jobs[index], after: jobToSave };
        jobs[index] = jobToSave;
      } else {
        jobToSave.createdAt = now;
        jobs.push(jobToSave);
        diff = { after: jobToSave };
      }
      saveStorage(STORAGE_KEYS.JOBS, jobs);
      createAuditLog('JOB', action, { entityType: 'Job', entityId: job.jobId, entityName: job.contactPerson }, `${action === 'CREATE' ? '新增' : '更新'}任務工單`, diff);

      // Core Logic: Sync Job status to Customer profile
      if (job.status === JobStatus.COMPLETED) {
        const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
        const cIndex = customers.findIndex(c => c.customer_id === job.customerId);
        if (cIndex >= 0) {
          const customer = customers[cIndex];
          const cJobs = jobs.filter(j => j.customerId === job.customerId && j.status === JobStatus.COMPLETED && !j.deletedAt);
          
          customer.is_returning = cJobs.length > 1;
          customer.last_service_date = job.serviceDate;
          customer.last_service_summary = job.serviceItems.join(', ');
          
          // Trigger AI Tagging if not skipped
          if (!options.skipAi && getAiCooldownSeconds() === 0 && job.serviceNote) {
            try {
              const newTags = await extractAiTags(job.serviceNote);
              const uniqueTags = Array.from(new Set([...(customer.ai_tags || []), ...newTags]));
              customer.ai_tags = uniqueTags.slice(0, 10);
            } catch (e) {
              console.warn("AI Tagging skipped:", e);
            }
          }
          saveStorage(STORAGE_KEYS.CUSTOMERS, customers);
        }
      }
      return jobToSave;
    },
    generateId: () => `JOB-${Date.now()}-${Math.floor(Math.random()*10000)}`
  },
  expenses: {
    getAll: () => getStorage<Expense>(STORAGE_KEYS.EXPENSES).filter(e => !e.deletedAt),
    save: (expense: Expense) => {
      const list = getStorage<Expense>(STORAGE_KEYS.EXPENSES);
      const index = list.findIndex(e => e.id === expense.id);
      let action: 'CREATE' | 'UPDATE' = 'CREATE';
      
      if (index >= 0) {
        action = 'UPDATE';
        list[index] = expense;
      } else {
        list.push(expense);
      }
      saveStorage(STORAGE_KEYS.EXPENSES, list);
      createAuditLog('EXPENSE', action, { entityType: 'Expense', entityId: expense.id, entityName: `${expense.category} $${expense.amount}` }, `${action === 'CREATE' ? '新增' : '更新'}支出`);
    },
    delete: (id: string) => {
      const list = getStorage<Expense>(STORAGE_KEYS.EXPENSES);
      const target = list.find(e => e.id === id);
      if (target) {
        target.deletedAt = new Date().toISOString();
        saveStorage(STORAGE_KEYS.EXPENSES, list);
        createAuditLog('EXPENSE', 'DELETE', { entityType: 'Expense', entityId: id }, `刪除支出: $${target.amount}`);
      }
    },
    generateId: () => `EXP-${Date.now()}`
  },
  settings: {
    get: (): AppSettings => {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    },
    save: (settings: AppSettings) => {
      const old = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      createAuditLog('SETTINGS', 'UPDATE', { entityType: 'Settings', entityId: 'global' }, '更新系統參數', { before: old ? JSON.parse(old) : null, after: settings });
    }
  },
  l2: {
    assets: {
      getAll: () => getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS).filter(i => !i.deletedAt),
      save: (item: L2Asset) => {
        const list = getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS);
        const idx = list.findIndex(i => i.id === item.id);
        if (idx >= 0) list[idx] = item; else list.push(item);
        saveStorage(STORAGE_KEYS.L2_ASSETS, list);
        createAuditLog('SETTINGS', idx >= 0 ? 'UPDATE' : 'CREATE', { entityType: 'Asset', entityId: item.id, entityName: item.name }, '更新資產清冊');
      },
      delete: (id: string) => {
        const list = getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS);
        const target = list.find(i => i.id === id);
        if(target) { target.deletedAt = new Date().toISOString(); saveStorage(STORAGE_KEYS.L2_ASSETS, list); }
      },
      generateId: () => `L2A-${Date.now()}`,
      seed: () => {
        const existing = getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS);
        if (existing.length > 0) return;
        const seeds: L2Asset[] = [
           { id: 'a1', name: '高壓清洗機 (主)', cost: 18000, purchaseDate: '2023-01-01', lifespanMonths: 36, status: 'active' },
           { id: 'a2', name: '沉水馬達', cost: 4500, purchaseDate: '2023-06-01', lifespanMonths: 24, status: 'active' },
           { id: 'a3', name: '工業吸塵器', cost: 6000, purchaseDate: '2023-03-01', lifespanMonths: 36, status: 'active' },
           { id: 'a4', name: '長梯 (12尺)', cost: 3500, purchaseDate: '2022-12-01', lifespanMonths: 60, status: 'active' }
        ];
        saveStorage(STORAGE_KEYS.L2_ASSETS, seeds);
      }
    },
    stock: {
      getAll: () => getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK).filter(i => !i.deletedAt),
      save: (item: L2StockLog) => {
        const list = getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK);
        const idx = list.findIndex(i => i.id === item.id);
        if (idx >= 0) list[idx] = item; else list.push(item);
        saveStorage(STORAGE_KEYS.L2_STOCK, list);
        createAuditLog('SETTINGS', idx >= 0 ? 'UPDATE' : 'CREATE', { entityType: 'Stock', entityId: item.id }, '更新庫存紀錄');
      },
      delete: (id: string) => {
        const list = getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK);
        const target = list.find(i => i.id === id);
        if(target) { target.deletedAt = new Date().toISOString(); saveStorage(STORAGE_KEYS.L2_STOCK, list); }
      },
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: (): L2LaborConfig => {
        const d = localStorage.getItem(STORAGE_KEYS.L2_LABOR);
        return d ? JSON.parse(d) : DEFAULT_L2_LABOR;
      },
      save: (cfg: L2LaborConfig) => {
        localStorage.setItem(STORAGE_KEYS.L2_LABOR, JSON.stringify(cfg));
        createAuditLog('SETTINGS', 'UPDATE', { entityType: 'LaborConfig', entityId: 'L2' }, '更新人力成本參數');
      }
    }
  }
};

// Auto Init
db.users.init();

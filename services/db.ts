
import { Customer, Job, JobStatus, Expense, AppSettings, L2Asset, L2StockLog, L2LaborConfig } from '../types';
import { extractAiTags, getAiCooldownSeconds } from './gemini';

const STORAGE_KEYS = {
  CUSTOMERS: 'erp_customers_v3',
  JOBS: 'erp_jobs_v3',
  EXPENSES: 'erp_expenses_v1',
  SETTINGS: 'erp_settings_v1',
  // Level 2 Keys
  L2_ASSETS: 'erp_l2_assets',
  L2_STOCK: 'erp_l2_stock',
  L2_LABOR: 'erp_l2_labor'
};

const getStorage = <T,>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveStorage = <T,>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const DEFAULT_SETTINGS: AppSettings = {
  monthlyTarget: 150000,
  monthlySalary: 60000, // Example default
  laborBreakdown: { bossSalary: 30000, partnerSalary: 30000 },
  consumables: {
    citricCostPerCan: 50,
    chemicalDrumCost: 3000,
    chemicalDrumToBottles: 20 // derived cost ~150
  }
};

const DEFAULT_L2_LABOR: L2LaborConfig = {
  bossSalary: 40000,
  partnerSalary: 35000,
  insuranceCost: 12000
};

export const db = {
  customers: {
    getAll: () => getStorage<Customer>(STORAGE_KEYS.CUSTOMERS),
    get: (id: string) => getStorage<Customer>(STORAGE_KEYS.CUSTOMERS).find(c => c.customer_id === id),
    delete: (id: string) => {
      const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS).filter(c => c.customer_id !== id);
      saveStorage(STORAGE_KEYS.CUSTOMERS, customers);
    },
    save: (customer: Customer) => {
      const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
      const index = customers.findIndex(c => c.customer_id === customer.customer_id);
      const now = new Date().toISOString();
      
      const displayName = customer.customerType === '公司'
        ? `${customer.companyName || ''} ${customer.contactName}`.trim()
        : customer.contactName;

      const updatedCustomer = { ...customer, displayName, updated_at: now };
      if (index >= 0) {
        customers[index] = updatedCustomer;
      } else {
        updatedCustomer.created_at = now;
        customers.push(updatedCustomer);
      }
      saveStorage(STORAGE_KEYS.CUSTOMERS, customers);
    },
    generateId: () => {
      const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
      const lastId = customers.length > 0 
        ? [...customers].sort((a,b) => b.customer_id.localeCompare(a.customer_id))[0].customer_id 
        : 'C0000000';
      const num = parseInt(lastId.substring(1)) + 1;
      return `C${String(num).padStart(7, '0')}`;
    }
  },
  jobs: {
    getAll: () => getStorage<Job>(STORAGE_KEYS.JOBS),
    get: (id: string) => getStorage<Job>(STORAGE_KEYS.JOBS).find(j => j.jobId === id),
    delete: (id: string) => {
      const jobs = getStorage<Job>(STORAGE_KEYS.JOBS).filter(j => j.jobId !== id);
      saveStorage(STORAGE_KEYS.JOBS, jobs);
    },
    save: async (job: Job, options: { skipAi?: boolean } = {}) => {
      const jobs = getStorage<Job>(STORAGE_KEYS.JOBS);
      const index = jobs.findIndex(j => j.jobId === job.jobId);
      const now = new Date().toISOString();
      
      const jobToSave = { ...job, updatedAt: now };
      if (index >= 0) {
        jobs[index] = jobToSave;
      } else {
        jobToSave.createdAt = now;
        jobs.push(jobToSave);
      }
      saveStorage(STORAGE_KEYS.JOBS, jobs);

      // Core Logic: Sync Job status to Customer profile
      if (job.status === JobStatus.COMPLETED) {
        const customers = getStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
        const cIndex = customers.findIndex(c => c.customer_id === job.customerId);
        if (cIndex >= 0) {
          const customer = customers[cIndex];
          const cJobs = jobs.filter(j => j.customerId === job.customerId && j.status === JobStatus.COMPLETED);
          
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
    getAll: () => getStorage<Expense>(STORAGE_KEYS.EXPENSES),
    save: (expense: Expense) => {
      const list = getStorage<Expense>(STORAGE_KEYS.EXPENSES);
      const index = list.findIndex(e => e.id === expense.id);
      if (index >= 0) list[index] = expense;
      else list.push(expense);
      saveStorage(STORAGE_KEYS.EXPENSES, list);
    },
    delete: (id: string) => {
      const list = getStorage<Expense>(STORAGE_KEYS.EXPENSES).filter(e => e.id !== id);
      saveStorage(STORAGE_KEYS.EXPENSES, list);
    },
    generateId: () => `EXP-${Date.now()}`
  },
  settings: {
    get: (): AppSettings => {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    },
    save: (settings: AppSettings) => {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  },
  // --- Level 2 Modules ---
  l2: {
    assets: {
      getAll: () => getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS),
      save: (item: L2Asset) => {
        const list = getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS);
        const idx = list.findIndex(i => i.id === item.id);
        if (idx >= 0) list[idx] = item; else list.push(item);
        saveStorage(STORAGE_KEYS.L2_ASSETS, list);
      },
      delete: (id: string) => saveStorage(STORAGE_KEYS.L2_ASSETS, getStorage<L2Asset>(STORAGE_KEYS.L2_ASSETS).filter(i => i.id !== id)),
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
      getAll: () => getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK),
      save: (item: L2StockLog) => {
        const list = getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK);
        const idx = list.findIndex(i => i.id === item.id);
        if (idx >= 0) list[idx] = item; else list.push(item);
        saveStorage(STORAGE_KEYS.L2_STOCK, list);
      },
      delete: (id: string) => saveStorage(STORAGE_KEYS.L2_STOCK, getStorage<L2StockLog>(STORAGE_KEYS.L2_STOCK).filter(i => i.id !== id)),
      generateId: () => `L2S-${Date.now()}`
    },
    labor: {
      get: (): L2LaborConfig => {
        const d = localStorage.getItem(STORAGE_KEYS.L2_LABOR);
        return d ? JSON.parse(d) : DEFAULT_L2_LABOR;
      },
      save: (cfg: L2LaborConfig) => localStorage.setItem(STORAGE_KEYS.L2_LABOR, JSON.stringify(cfg))
    }
  }
};


import { Customer, Job, JobStatus, Expense, AppSettings } from '../types';
import { extractAiTags, getAiCooldownSeconds } from './gemini';

const STORAGE_KEYS = {
  CUSTOMERS: 'erp_customers_v3',
  JOBS: 'erp_jobs_v3',
  EXPENSES: 'erp_expenses_v1',
  SETTINGS: 'erp_settings_v1'
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
  consumables: {
    citricCostPerCan: 50,
    chemicalDrumCost: 3000,
    chemicalDrumToBottles: 20 // derived cost ~150
  }
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
  }
};

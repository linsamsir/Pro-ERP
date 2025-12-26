
export enum Preference {
  PHONE = '電話',
  MESSAGE = '訊息'
}

export enum BuildingType {
  DETACHED = '透天',
  BUILDING = '大樓',
  MANSION = '華廈',
  APARTMENT = '公寓',
  FACTORY = '工廠',
  WAREHOUSE = '倉庫',
  MALL = '賣場',
  OTHER = '其他'
}

export enum ServiceItem {
  TANK = '水塔清洗',
  PIPE = '水管清洗'
}

export enum JobStatus {
  PENDING = '待處理',
  COMPLETED = '已完工',
  CANCELLED = '流案'
}

export type AvatarType = 
  | 'grandpa' | 'grandma' | 'man' | 'woman' | 'boy' | 'girl' 
  | 'building' | 'factory' | 'angel' | 'devil';

export interface SocialAccount {
  platform: 'LINE' | 'FB' | 'IG' | 'Threads' | '官網' | 'TikTok' | '其他';
  displayName: string; // ID or Handle
  lineChannelType?: '公司手機' | '闆娘手機' | '老闆手機' | '官方帳號';
  lineDisplayName?: string; // LINE 暱稱
}

export interface PhoneRecord {
  number: string;
  type: '手機' | '市話';
  isPrimary: boolean;
  label: string; // e.g. 屋主, 房客, 會計
}

export interface AddressRecord {
  text: string;
  isPrimary: boolean;
}

export interface CustomerSource {
  channel: '電話' | '社群' | '介紹' | '其他';
  detail?: string; // for '其他' or general notes
  social?: SocialAccount;
  referrerCustomerId?: string; // Link to another customer
  referrerName?: string; // Fallback if quick add
}

export interface Customer {
  customer_id: string;
  customerType: '個人' | '公司';
  
  // Basic Info
  companyName?: string;
  taxId?: string;
  contactName: string; // 聯絡人/稱呼
  displayName: string; // Auto-generated: 公司名+聯絡人 OR 稱呼
  
  // Contact
  preference: Preference;
  phones: PhoneRecord[];
  addresses: AddressRecord[];
  socialAccounts: SocialAccount[]; // Legacy compatibility, prefer source.social for origin
  
  // Building & Environment
  building_type: BuildingType;
  building_name?: string; // 建案/社區名稱
  has_elevator: boolean;
  
  // Source & Meta
  source?: CustomerSource;
  is_returning: boolean;
  ai_tags: string[];
  avatar: AvatarType;
  
  // Village Game Stats
  interactionStatus?: 'angel' | 'devil' | 'normal';
  last_service_date?: string;
  last_service_summary?: string;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Soft delete
  
  // Legacy fields to be maintained but maybe unused
  invoiceNeeded?: boolean; 
}

export interface TankConfig {
  id: string; // unique id for list management
  location: '地下室' | '一樓室內' | '一樓戶外' | '陽台外' | '頂樓室內' | '頂樓戶外';
  material: '不鏽鋼' | '塑膠' | 'RC' | '其他';
  orientation: '直式' | '橫式';
  tonnage: string; // 1, 1.5, 2, 3, 5+
  count: number;
  isRaised: boolean;
  hasMotor: boolean; // 加壓馬達
}

// New Structured Interfaces for P0-3 Upgrade
export interface Consumables {
  citric_acid: number; // 單位：罐 (0, 0.5, 1...)
  chemical: number;    // 單位：罐
}

export interface ExtraItem {
  id: string; // UUID for UI list keys
  name: string;
  amount: number;
}

export interface FinancialData {
  total_amount: number;
  payment_method: '現金' | '轉帳' | '其他';
  invoice_issued: boolean;
  extra_items: ExtraItem[]; 
}

export interface Job {
  jobId: string;
  customerId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete
  
  // Section A: Snapshot
  contactPerson: string;
  contactPhone: string;
  
  // Section B: Service Config
  serviceItems: ServiceItem[];
  
  // Tank Details
  tankConfigs: TankConfig[];
  
  // Pipe Details
  bathroomCount: number;
  kitchenCount: number;
  waterSourceTypes: string[]; // 自來水, 地下水
  waterHeaterType: '瓦斯' | '電熱' | '熱泵' | '太陽能' | '無' | '不確定';
  
  // Section C: Execution Logic (Tags & Results)
  tankConditionTags: string[]; // 輕微/嚴重/土灰...
  pipeBeforeStatus: '保養' | '半堵' | '全堵';
  pipeAfterStatus: '改善明顯' | '持平' | '改善有限';
  
  // Section C-2: Subjective Tags (New)
  subjective_tags: string[];

  // Section D: Time & Travel
  bookingDate: string;
  bookingSlot: '早' | '午' | '晚';
  serviceDate: string;
  
  /** @new P0-3: Strict time format HH:mm */
  arrival_time: string;
  
  workDurationHours: number;
  
  // Travel Logic
  travelMode: '單程' | '來回';
  travelBaseMinutes: number; // 單程預設 (New)
  travelMinutesCalculated: number; // 最終總時間 (Total)
  travelMinutesOverride?: number; // 手動覆寫 (New)
  
  /** @new P0-3: Consolidated Consumables */
  consumables: Consumables;
  
  /** @new P0-3: Consolidated Financials */
  financial: FinancialData;
  
  // Section F: Meta
  serviceNote: string;
  
  // --- Legacy fields (Maintained for backward compatibility or migration) ---
  arrivalTimePreset?: string; // Deprecated
  citricAcidCans?: number; // Deprecated
  otherChemicalCans?: number; // Deprecated
  totalPaid?: number; // Deprecated
  paymentMethod?: '現金' | '轉帳' | '其他'; // Deprecated
  invoiceNeeded?: boolean; // Deprecated
  hasExtraCharge?: boolean; // Deprecated
  extraChargeItems?: Array<{name: string, amount: number}>; // Deprecated
  extraChargeAmount?: number; // Deprecated
  extraChargeNote?: string; // Deprecated
  hasBoosterPump?: '是' | '否' | '不確定';
  groundPumpOk?: '是' | '否' | '不確定';
  waterSelfToTank?: '是' | '否' | '不確定';
  pipeResultTags?: string[];
}

// --- Dashboard v2 New Interfaces ---

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: 'insurance' | 'utilities' | 'phone' | 'fuel' | 'other' | 'consumables' | 'equipment'; // Expanded
  amount: number;
  paymentMethod?: string;
  note?: string;
  createdAt: string;
  deletedAt?: string; // Soft delete
  
  // Chat Input Metadata
  source?: 'manual_form' | 'chat_input';
  raw_input?: string;
}

export interface AppSettings {
  monthlyTarget: number;
  monthlySalary: number; // Total combined salary
  laborBreakdown?: { // New in Level 2
    bossSalary: number;
    partnerSalary: number;
  };
  consumables: {
    citricCostPerCan: number;
    chemicalDrumCost: number;
    chemicalDrumToBottles: number;
  };
}

// --- Level 2: Advanced Cost Module Types ---

export interface L2Asset {
  id: string;
  name: string;
  purchaseDate: string; // YYYY-MM-DD
  cost: number;
  lifespanMonths: number;
  status: 'active' | 'retired' | 'maintenance';
  deletedAt?: string;
}

export interface L2StockLog {
  id: string;
  date: string;
  itemType: 'citric' | 'chemical';
  purchaseType: 'bulk' | 'retail';
  quantity: number; // 桶數/包數
  totalCost: number;
  yieldPerUnit: number; // 一桶可分裝幾罐
  deletedAt?: string;
}

export interface L2LaborConfig {
  bossSalary: number;
  partnerSalary: number;
  insuranceCost: number;
}

// --- Level 0: Auth & Audit ---

export type UserRole = 'BOSS' | 'MANAGER' | 'STAFF' | 'DECOY';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string; // Simulated
}

export interface AuditLog {
  id: string;
  createdAt: string; // ISO String
  actor: {
    userId: string;
    name: string;
    role: UserRole;
  };
  module: 'AUTH' | 'CUSTOMER' | 'JOB' | 'EXPENSE' | 'SETTINGS' | 'SYSTEM';
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'RESTORE';
  target: {
    entityType: string;
    entityId: string;
    entityName?: string;
  };
  summary: string;
  diff?: {
    before?: any;
    after?: any;
  };
}

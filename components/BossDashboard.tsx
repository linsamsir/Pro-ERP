
import React from 'react';
import { db } from '../services/db';
import { Job, Customer, JobStatus, Expense, AppSettings, L2LaborConfig } from '../types';
import { 
  TrendingUp, DollarSign, Calendar, Target,
  Download, Activity, Users, Filter, CheckCircle2, XCircle,
  Settings, Plus, Droplets, Zap, ShieldCheck, Trash2, MessageCircle, HardHat, Package
} from 'lucide-react';
import ChatExpenseModal from './ChatExpenseModal';

// Types for View State
type RangeType = 'this_month' | 'last_month' | 'last_7d' | 'last_30d';
type TabType = 'revenue' | 'expenses' | 'consumables' | 'rfm';

interface DateRange {
  start: Date;
  end: Date;
  type: RangeType;
}

// --- Extracted Components ---

interface UnifiedSettingsModalProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  l2Labor: L2LaborConfig;
  setL2Labor: React.Dispatch<React.SetStateAction<L2LaborConfig>>;
  onClose: () => void;
  onSave: () => void;
}

const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({ 
  settings, setSettings, l2Labor, setL2Labor, onClose, onSave 
}) => {
  const [tab, setTab] = React.useState<'general' | 'consumables' | 'labor'>('general');

  // Sync settings.monthlySalary with L2 labor changes
  React.useEffect(() => {
    setSettings(s => ({
        ...s,
        monthlySalary: l2Labor.bossSalary + l2Labor.partnerSalary + l2Labor.insuranceCost
    }));
  }, [l2Labor, setSettings]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-pop">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg shadow-2xl border-4 border-[#e8dcb9] flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-h2 flex items-center gap-2 text-[#5d4a36]">
            <Settings size={24} className="text-[#b59a7a]" /> 系統參數設定
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
            <XCircle size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-100 pb-2">
           <button onClick={() => setTab('general')} className={`pb-2 text-body font-bold transition-colors ${tab==='general' ? 'text-[#78b833] border-b-4 border-[#78b833]' : 'text-slate-400'}`}>基本目標</button>
           <button onClick={() => setTab('consumables')} className={`pb-2 text-body font-bold transition-colors ${tab==='consumables' ? 'text-[#78b833] border-b-4 border-[#78b833]' : 'text-slate-400'}`}>耗材成本</button>
           <button onClick={() => setTab('labor')} className={`pb-2 text-body font-bold transition-colors ${tab==='labor' ? 'text-[#78b833] border-b-4 border-[#78b833]' : 'text-slate-400'}`}>人力設定 (L2)</button>
        </div>
        
        <div className="space-y-6 overflow-y-auto flex-1 p-2">
          {tab === 'general' && (
              <div className="space-y-4">
                  <div>
                      <label className="text-note mb-1 block">每月營收目標 (元)</label>
                      <input type="number" className="input-nook" value={settings.monthlyTarget} onChange={e => setSettings({...settings, monthlyTarget: parseInt(e.target.value)||0})} />
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl text-sm text-orange-700 font-bold border border-orange-100 flex gap-2">
                      <Target size={20} className="shrink-0"/>
                      設定目標後，戰情室會自動計算每日需達成的金額。
                  </div>
              </div>
          )}

          {tab === 'consumables' && (
              <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="text-body font-bold mb-3 flex items-center gap-2"><Droplets size={18}/> 檸檬酸設定</div>
                      <label className="text-note mb-1 block">每罐平均成本</label>
                      <input type="number" className="input-nook" value={settings.consumables.citricCostPerCan} onChange={e => setSettings({...settings, consumables: {...settings.consumables, citricCostPerCan: parseInt(e.target.value)||0}})} />
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="text-body font-bold mb-3 flex items-center gap-2"><Zap size={18}/> 藥劑設定</div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-note mb-1 block">每桶進價</label>
                              <input type="number" className="input-nook" value={settings.consumables.chemicalDrumCost} onChange={e => setSettings({...settings, consumables: {...settings.consumables, chemicalDrumCost: parseInt(e.target.value)||0}})} />
                          </div>
                          <div>
                              <label className="text-note mb-1 block">每桶分裝罐數</label>
                              <input type="number" className="input-nook" value={settings.consumables.chemicalDrumToBottles} onChange={e => setSettings({...settings, consumables: {...settings.consumables, chemicalDrumToBottles: parseInt(e.target.value)||0}})} />
                          </div>
                      </div>
                      <div className="text-right text-note mt-2 text-orange-500">
                          = 平均每罐成本 ${Math.round(settings.consumables.chemicalDrumCost / settings.consumables.chemicalDrumToBottles)}
                      </div>
                  </div>
              </div>
          )}

          {tab === 'labor' && (
              <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <h4 className="text-body font-bold text-blue-800 mb-4 flex items-center gap-2"><HardHat size={18}/> 固定月薪 (用於成本攤提)</h4>
                      <div className="space-y-3">
                          <div>
                              <label className="text-note mb-1 block">老闆月薪</label>
                              <input type="number" className="input-nook" value={l2Labor.bossSalary} onChange={e => setL2Labor({...l2Labor, bossSalary: parseInt(e.target.value)||0})} />
                          </div>
                          <div>
                              <label className="text-note mb-1 block">闆娘月薪</label>
                              <input type="number" className="input-nook" value={l2Labor.partnerSalary} onChange={e => setL2Labor({...l2Labor, partnerSalary: parseInt(e.target.value)||0})} />
                          </div>
                          <div>
                              <label className="text-note mb-1 block">勞健保總負擔</label>
                              <input type="number" className="input-nook" value={l2Labor.insuranceCost} onChange={e => setL2Labor({...l2Labor, insuranceCost: parseInt(e.target.value)||0})} />
                          </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-blue-200 flex justify-between items-center">
                          <span className="text-note">每月總固定支出</span>
                          <span className="text-h3 text-blue-900">${(l2Labor.bossSalary + l2Labor.partnerSalary + l2Labor.insuranceCost).toLocaleString()}</span>
                      </div>
                  </div>
              </div>
          )}
        </div>
        
        <button 
          onClick={onSave}
          className="w-full mt-6 btn-primary"
        >
          儲存所有設定
        </button>
      </div>
    </div>
  );
};

interface AddExpenseModalProps {
  onClose: () => void;
  onSave: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onClose, onSave }) => {
  const [form, setForm] = React.useState<Partial<Expense>>({
    date: new Date().toLocaleDateString('en-CA'),
    category: 'other',
    amount: 0,
    note: ''
  });

  const handleSubmit = () => {
    if (!form.amount) return alert('請輸入金額');
    const newExp: Expense = {
      id: db.expenses.generateId(),
      date: form.date!,
      category: form.category as any,
      amount: form.amount!,
      note: form.note,
      createdAt: new Date().toISOString(),
      source: 'manual_form'
    };
    db.expenses.save(newExp);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-pop">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border-4 border-[#e8dcb9]">
        <h3 className="text-h2 text-[#5d4a36] mb-6">記一筆支出</h3>
        <div className="space-y-4">
           <div>
              <label className="text-note mb-1 block">日期</label>
              <input type="date" className="input-nook" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
           </div>
           <div>
              <label className="text-note mb-1 block">類別</label>
              <select className="input-nook" value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                  <option value="insurance">勞健保</option>
                  <option value="utilities">公司水電</option>
                  <option value="phone">電話費</option>
                  <option value="fuel">油資</option>
                  <option value="other">其他雜支</option>
              </select>
           </div>
           <div>
              <label className="text-note mb-1 block">金額</label>
              <input type="number" placeholder="$" className="input-nook text-xl" value={form.amount || ''} onChange={e => setForm({...form, amount: parseInt(e.target.value)})} />
           </div>
           <div>
              <label className="text-note mb-1 block">備註</label>
              <input type="text" placeholder="(選填)" className="input-nook" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
           </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-500 hover:bg-slate-200">取消</button>
          <button onClick={handleSubmit} className="flex-1 btn-primary text-base py-3">儲存</button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

const BossDashboard: React.FC = () => {
  // --- Global State ---
  const [settings, setSettings] = React.useState<AppSettings>(db.settings.get());
  const [l2Labor, setL2Labor] = React.useState<L2LaborConfig>(db.l2.labor.get());
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);

  // --- View State ---
  const [dateRange, setDateRange] = React.useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of month
    return { start, end, type: 'this_month' };
  });
  const [activeTab, setActiveTab] = React.useState<TabType>('revenue');
  
  // Modals
  const [showSettings, setShowSettings] = React.useState(false);
  const [showAddExpense, setShowAddExpense] = React.useState(false);
  const [showChatExpense, setShowChatExpense] = React.useState(false);
  
  // --- Init & Refresh ---
  const refreshData = () => {
    setJobs(db.jobs.getAll());
    setCustomers(db.customers.getAll());
    setExpenses(db.expenses.getAll());
    setSettings(db.settings.get());
    setL2Labor(db.l2.labor.get());
  };

  React.useEffect(() => {
    refreshData();
  }, []);

  // --- Date Logic ---
  const handleRangeChange = (type: RangeType) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (type === 'last_7d') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      end = new Date(now);
    } else if (type === 'last_30d') {
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      end = new Date(now);
    }
    setDateRange({ start, end, type });
  };

  const isInRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const s = new Date(dateRange.start); s.setHours(0,0,0,0);
    const e = new Date(dateRange.end); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  // --- Derived Data (Memoized) ---
  const filteredJobs = React.useMemo(() => 
    jobs.filter(j => j.status === JobStatus.COMPLETED && isInRange(j.serviceDate))
  , [jobs, dateRange]);

  const filteredExpenses = React.useMemo(() => 
    expenses.filter(e => isInRange(e.date))
  , [expenses, dateRange]);

  const topCustomers = React.useMemo(() => {
    const stats: Record<string, { totalSpent: number, jobCount: number, lastJobDate: string }> = {};
    
    // Process all jobs (not just filtered ones) for lifetime value
    jobs.forEach(j => {
      if (j.status === JobStatus.COMPLETED) {
        if (!stats[j.customerId]) {
          stats[j.customerId] = { totalSpent: 0, jobCount: 0, lastJobDate: '' };
        }
        const s = stats[j.customerId];
        s.totalSpent += (j.financial?.total_amount || j.totalPaid || 0);
        s.jobCount++;
        if (!s.lastJobDate || j.serviceDate > s.lastJobDate) {
           s.lastJobDate = j.serviceDate;
        }
      }
    });

    return customers
      .map(c => ({
         ...c,
         totalSpent: stats[c.customer_id]?.totalSpent || 0,
         jobCount: stats[c.customer_id]?.jobCount || 0,
         lastJobDate: stats[c.customer_id]?.lastJobDate || ''
      }))
      .sort((a,b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [jobs, customers]);

  // --- Financial Calculations ---
  const totalRevenue = filteredJobs.reduce((sum, j) => sum + (j.financial?.total_amount || j.totalPaid || 0), 0);
  const chemicalUnitCost = settings.consumables.chemicalDrumCost / settings.consumables.chemicalDrumToBottles;
  const consumablesCost = filteredJobs.reduce((sum, j) => {
    const citric = j.consumables?.citric_acid ?? j.citricAcidCans ?? 0;
    const chemical = j.consumables?.chemical ?? j.otherChemicalCans ?? 0;
    return sum + (citric * settings.consumables.citricCostPerCan) + (chemical * chemicalUnitCost);
  }, 0);
  const opexCost = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const daysInView = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 3600 * 24)) + 1;
  const isFullMonth = dateRange.type === 'this_month' || dateRange.type === 'last_month';
  const laborCost = isFullMonth 
    ? settings.monthlySalary 
    : Math.round((settings.monthlySalary / 30) * daysInView);
  const totalCosts = consumablesCost + opexCost + laborCost;
  const netProfit = totalRevenue - totalCosts;
  const target = settings.monthlyTarget;
  const gapToTarget = target - totalRevenue;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const remainingDays = dateRange.type === 'this_month' ? Math.max(0, daysInMonth - new Date().getDate()) : 0;
  const dailyNeeded = remainingDays > 0 && gapToTarget > 0 ? Math.ceil(gapToTarget / remainingDays) : 0;

  // --- Components ---
  const StatCard = ({ label, value, sub, icon: Icon, colorClass, borderClass }: any) => (
    <div className={`ac-card ${borderClass} relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${colorClass} opacity-10`}>
        <Icon size={40} />
      </div>
      <div className="text-note mb-2 flex items-center gap-2">
        <Icon size={16} /> {label}
      </div>
      <div className="text-h1 font-black tracking-tight">{value}</div>
      {sub && <div className="text-note mt-2 opacity-80">{sub}</div>}
    </div>
  );

  const downloadCSV = (content: string, filename: string) => {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSettingsSave = () => {
    // Save L1
    db.settings.save(settings);
    // Save L2
    db.l2.labor.save(l2Labor);
    
    setShowSettings(false);
    refreshData();
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-pop">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-h1 flex items-center gap-3">
            <Activity className="text-[#78b833]" size={36} /> 老闆戰情室
          </h1>
          <p className="text-note font-bold mt-2 ml-1">
            即時掌握營運狀況
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['this_month', 'last_month', 'last_7d', 'last_30d'] as RangeType[]).map(type => (
            <button 
              key={type}
              onClick={() => handleRangeChange(type)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 whitespace-nowrap transition-all ${
                dateRange.type === type 
                ? 'bg-[#5d4a36] border-[#5d4a36] text-white shadow-md' 
                : 'bg-white border-[#e8dcb9] text-[#b59a7a] hover:bg-[#fffdf5]'
              }`}
            >
              {type === 'this_month' ? '本月' : type === 'last_month' ? '上月' : type === 'last_7d' ? '近7天' : '近30天'}
            </button>
          ))}
          <button onClick={() => setShowSettings(true)} className="px-3 py-2 rounded-xl bg-white border-2 border-[#e8dcb9] text-[#b59a7a] hover:text-[#78b833]">
             <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="bg-[#fffbf0] border-l-4 border-[#78b833] p-4 rounded-r-xl text-body font-bold text-[#b59a7a] flex flex-wrap gap-4 justify-between items-center shadow-sm">
         <span>統計區間：{dateRange.start.toLocaleDateString()} ~ {dateRange.end.toLocaleDateString()} ({daysInView} 天)</span>
         {activeTab === 'expenses' && (
           <div className="flex gap-3">
              <button onClick={() => setShowChatExpense(true)} className="bg-white border border-[#e8dcb9] text-[#5d4a36] px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 font-bold transition-colors hover:border-[#78b833]">
                <MessageCircle size={16}/> 對話輸入
              </button>
              <button onClick={() => setShowAddExpense(true)} className="bg-[#78b833] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 font-bold hover:bg-[#5a8d26]">
                <Plus size={16}/> 記一筆
              </button>
           </div>
         )}
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard 
           label="區間營收 (Revenue)" 
           value={`$${totalRevenue.toLocaleString()}`} 
           sub={`${filteredJobs.length} 張工單`}
           icon={TrendingUp}
           borderClass="border-[#78b833]"
           colorClass="bg-[#78b833]"
         />
         <StatCard 
           label="總成本 (Total Costs)" 
           value={`$${totalCosts.toLocaleString()}`} 
           sub={`含薪資 ${laborCost.toLocaleString()}`}
           icon={Zap}
           borderClass="border-red-200"
           colorClass="bg-red-400"
         />
         <StatCard 
           label="淨利 (Net Profit)" 
           value={`$${netProfit.toLocaleString()}`} 
           sub={`淨利率 ${totalRevenue > 0 ? Math.round((netProfit/totalRevenue)*100) : 0}%`}
           icon={DollarSign}
           borderClass={netProfit >= 0 ? "border-[#5d4a36]" : "border-red-500"}
           colorClass={netProfit >= 0 ? "bg-[#e8dcb9]" : "bg-red-100"}
         />
         
         {/* Target Card */}
         <div className="ac-card border-[#e8dcb9] flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div>
                 <div className="text-note mb-2 flex items-center gap-2"><Target size={16}/> 月目標進度</div>
                 <div className="text-h2 text-[#5d4a36]">${totalRevenue.toLocaleString()} <span className="text-sm text-slate-300 font-normal">/ {settings.monthlyTarget/1000}k</span></div>
               </div>
               <div className={`px-3 py-1 rounded-lg text-xs font-black ${gapToTarget > 0 ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600'}`}>
                 {gapToTarget > 0 ? `${Math.round((totalRevenue/target)*100)}%` : '達成'}
               </div>
            </div>
            {dateRange.type === 'this_month' && gapToTarget > 0 && (
               <div className="mt-3 text-sm text-slate-400 font-bold bg-slate-50 p-2 rounded-lg">
                  剩 {remainingDays} 天，每天需做 <span className="font-black text-[#5d4a36]">${dailyNeeded.toLocaleString()}</span>
               </div>
            )}
         </div>
      </div>

      {/* 3. Main Tables Area */}
      <div className="bg-white rounded-[2rem] shadow-lg border-2 border-[#e8dcb9] overflow-hidden min-h-[500px]">
        {/* Tabs */}
        <div className="flex border-b border-[#e8dcb9] bg-[#fbf8e6] overflow-x-auto">
           {[
             {id: 'revenue', icon: Filter, label: '訂單明細'},
             {id: 'expenses', icon: CheckCircle2, label: '支出紀錄'},
             {id: 'consumables', icon: Droplets, label: '耗材分析'},
             {id: 'rfm', icon: Users, label: '客戶價值'}
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as TabType)}
               className={`flex-1 min-w-[120px] py-5 font-bold text-body flex items-center justify-center gap-2 transition-colors border-b-4 ${
                 activeTab === tab.id ? 'bg-white text-[#5d4a36] border-[#78b833]' : 'text-[#b59a7a] border-transparent hover:bg-[#fffdf5]'
               }`}
             >
               <tab.icon size={18}/> {tab.label}
             </button>
           ))}
        </div>

        {/* Toolbar */}
        <div className="p-5 bg-white border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-[#5d4a36] text-body pl-2">
             {activeTab === 'revenue' && `共 ${filteredJobs.length} 筆完工資料`}
             {activeTab === 'expenses' && `共 ${filteredExpenses.length} 筆支出 (${opexCost.toLocaleString()})`}
             {activeTab === 'consumables' && `耗材成本 $${consumablesCost.toLocaleString()}`}
             {activeTab === 'rfm' && `Top 10 高價值客戶`}
           </h3>
           <button 
             onClick={() => {
                let csv = '';
                if (activeTab === 'revenue') {
                   csv = ['日期,客戶,項目,金額,工時,備註'].join(',') + '\n' + 
                         filteredJobs.map(j => `${j.serviceDate},${j.contactPerson},"${j.serviceItems.join('+')}",${j.financial?.total_amount||0},${j.workDurationHours},"${j.serviceNote}"`).join('\n');
                   downloadCSV(csv, `營收_${dateRange.start.toISOString().slice(0,10)}.csv`);
                } else if (activeTab === 'expenses') {
                   csv = ['日期,類別,金額,備註,來源'].join(',') + '\n' + 
                         filteredExpenses.map(e => `${e.date},${e.category},${e.amount},"${e.note}",${e.source||'manual'}`).join('\n');
                   downloadCSV(csv, `支出_${dateRange.start.toISOString().slice(0,10)}.csv`);
                }
             }}
             className="px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200 transition-colors"
           >
             <Download size={16} /> 匯出報表
           </button>
        </div>

        {/* Content */}
        <div className="overflow-x-auto">
          {activeTab === 'revenue' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-5 text-note">日期</th>
                  <th className="p-5 text-note">客戶</th>
                  <th className="p-5 text-note">項目</th>
                  <th className="p-5 text-note text-right">金額</th>
                  <th className="p-5 text-note">付款</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map(job => (
                  <tr key={job.jobId} className="hover:bg-[#f0fdf4]">
                    <td className="p-5 text-body font-bold text-[#5d4a36] whitespace-nowrap">{job.serviceDate}</td>
                    <td className="p-5 text-body font-bold text-[#5d4a36]">{job.contactPerson}</td>
                    <td className="p-5 text-sm text-slate-500">{job.serviceItems.join('+')}</td>
                    <td className="p-5 text-body font-black text-[#78b833] text-right">${(job.financial?.total_amount||0).toLocaleString()}</td>
                    <td className="p-5 text-sm text-slate-400">{job.financial?.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-5 text-note">日期</th>
                  <th className="p-5 text-note">類別</th>
                  <th className="p-5 text-note">備註</th>
                  <th className="p-5 text-note text-right">金額</th>
                  <th className="p-5 text-note">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-300">本區間無支出紀錄</td></tr>}
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-red-50">
                    <td className="p-5 text-body font-bold text-[#5d4a36] whitespace-nowrap">{exp.date}</td>
                    <td className="p-5 text-sm font-bold text-slate-500 uppercase">{exp.category === 'fuel' ? '⛽ 油資' : exp.category === 'utilities' ? '💡 水電' : exp.category === 'insurance' ? '🏥 勞健保' : exp.category === 'phone' ? '📱 電話' : '📦 雜支'}</td>
                    <td className="p-5 text-sm text-slate-400">
                       {exp.note}
                       {exp.source === 'chat_input' && <span className="ml-2 inline-block text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">AI</span>}
                    </td>
                    <td className="p-5 text-body font-black text-red-400 text-right">${exp.amount.toLocaleString()}</td>
                    <td className="p-5 text-center">
                       <button onClick={() => { if(confirm('刪除此支出？')) { db.expenses.delete(exp.id); refreshData(); } }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'consumables' && (
             <div className="p-8">
                <div className="flex flex-col md:flex-row gap-6 mb-8">
                   <div className="flex-1 bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                      <div className="text-note text-yellow-600 mb-3">檸檬酸總用量</div>
                      <div className="text-h2 text-[#5d4a36] mb-1">
                         {filteredJobs.reduce((sum, j) => sum + (j.consumables?.citric_acid??0), 0)} <span className="text-sm text-slate-400 font-normal">罐</span>
                      </div>
                      <div className="text-sm text-slate-400">成本約 ${filteredJobs.reduce((sum, j) => sum + (j.consumables?.citric_acid??0) * settings.consumables.citricCostPerCan, 0).toLocaleString()}</div>
                   </div>
                   <div className="flex-1 bg-blue-50 p-6 rounded-2xl border border-blue-200">
                      <div className="text-note text-blue-600 mb-3">藥劑總用量</div>
                      <div className="text-h2 text-[#5d4a36] mb-1">
                         {filteredJobs.reduce((sum, j) => sum + (j.consumables?.chemical??0), 0)} <span className="text-sm text-slate-400 font-normal">罐</span>
                      </div>
                      <div className="text-sm text-slate-400">成本約 ${filteredJobs.reduce((sum, j) => sum + (j.consumables?.chemical??0) * chemicalUnitCost, 0).toLocaleString()}</div>
                   </div>
                </div>
                <table className="w-full text-left border-collapse border border-slate-100 rounded-xl">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="p-4 text-note">工單日期</th>
                         <th className="p-4 text-note">客戶</th>
                         <th className="p-4 text-note text-right">檸檬酸</th>
                         <th className="p-4 text-note text-right">藥劑</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredJobs.slice(0, 10).map(j => (
                         <tr key={j.jobId}>
                            <td className="p-4 text-sm">{j.serviceDate}</td>
                            <td className="p-4 text-sm text-slate-500">{j.contactPerson}</td>
                            <td className="p-4 text-sm text-right font-mono">{j.consumables?.citric_acid}</td>
                            <td className="p-4 text-sm text-right font-mono">{j.consumables?.chemical}</td>
                         </tr>
                      ))}
                      {filteredJobs.length > 10 && <tr><td colSpan={4} className="p-4 text-center text-sm text-slate-400">...僅顯示前 10 筆...</td></tr>}
                   </tbody>
                </table>
             </div>
          )}

          {activeTab === 'rfm' && (
             <div className="p-0">
               <div className="p-6 bg-orange-50 border-b border-orange-100 text-sm font-bold text-orange-600 flex gap-2">
                  <ShieldCheck size={18}/> 顯示累積消費最高的 Top 10 客戶（全時期統計）
               </div>
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50">
                   <tr>
                     <th className="p-5 text-note">排名</th>
                     <th className="p-5 text-note">客戶</th>
                     <th className="p-5 text-note text-right">累積消費</th>
                     <th className="p-5 text-note text-center">次數</th>
                     <th className="p-5 text-note">最近消費</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {topCustomers.map((c, idx) => (
                     <tr key={c.customer_id} className="hover:bg-[#fff7ed]">
                       <td className="p-5 text-body font-black text-[#b59a7a] w-12 text-center">#{idx+1}</td>
                       <td className="p-5 text-body font-bold text-[#5d4a36]">
                         {c.displayName}
                         {c.totalSpent > 20000 && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">VIP</span>}
                       </td>
                       <td className="p-5 text-body font-black text-orange-400 text-right font-mono">${c.totalSpent.toLocaleString()}</td>
                       <td className="p-5 text-sm text-center">{c.jobCount}</td>
                       <td className="p-5 text-sm text-slate-400">{c.lastJobDate || '無'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>
      </div>

      {showSettings && <UnifiedSettingsModal 
        settings={settings}
        setSettings={setSettings}
        l2Labor={l2Labor}
        setL2Labor={setL2Labor}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
      />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onSave={refreshData} />}
      {showChatExpense && <ChatExpenseModal onClose={() => setShowChatExpense(false)} onSaved={refreshData} />}
    </div>
  );
};

export default BossDashboard;


import React from 'react';
import { db } from '../services/db';
import { Job, Customer, JobStatus, Expense, AppSettings } from '../types';
import { 
  TrendingUp, DollarSign, Calendar, Target, AlertCircle, 
  Download, Activity, Users, Clock, Filter, CheckCircle2, XCircle,
  Settings, Plus, ChevronDown, ChevronUp, Droplets, Briefcase, Truck, Phone, Zap, ShieldCheck, FileText, ChevronRight, Trash2
} from 'lucide-react';

// Types for View State
type RangeType = 'this_month' | 'last_month' | 'last_7d' | 'last_30d' | 'custom';
type TabType = 'revenue' | 'expenses' | 'consumables' | 'rfm';

interface DateRange {
  start: Date;
  end: Date;
  type: RangeType;
}

const BossDashboard: React.FC = () => {
  // --- Global State ---
  const [settings, setSettings] = React.useState<AppSettings>(db.settings.get());
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
  
  // --- Init & Refresh ---
  const refreshData = () => {
    setJobs(db.jobs.getAll());
    setCustomers(db.customers.getAll());
    setExpenses(db.expenses.getAll());
    setSettings(db.settings.get());
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
    // Custom logic would go here (omitted for brevity, defaulting to current selection if custom)
    setDateRange({ start, end, type });
  };

  // Helper to check if date string is in range
  const isInRange = (dateStr: string) => {
    const d = new Date(dateStr);
    // Reset times to ensure inclusive comparison
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

  // --- Financial Calculations ---
  
  // 1. Revenue
  const totalRevenue = filteredJobs.reduce((sum, j) => sum + (j.financial?.total_amount || j.totalPaid || 0), 0);

  // 2. Consumables Cost
  const chemicalUnitCost = settings.consumables.chemicalDrumCost / settings.consumables.chemicalDrumToBottles;
  const consumablesCost = filteredJobs.reduce((sum, j) => {
    const citric = j.consumables?.citric_acid ?? j.citricAcidCans ?? 0;
    const chemical = j.consumables?.chemical ?? j.otherChemicalCans ?? 0;
    return sum + (citric * settings.consumables.citricCostPerCan) + (chemical * chemicalUnitCost);
  }, 0);

  // 3. Operating Expenses
  const opexCost = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 4. Labor Cost (Prorated)
  const daysInView = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 3600 * 24)) + 1;
  const isFullMonth = dateRange.type === 'this_month' || dateRange.type === 'last_month';
  const laborCost = isFullMonth 
    ? settings.monthlySalary 
    : Math.round((settings.monthlySalary / 30) * daysInView);

  // 5. Net Profit
  const totalCosts = consumablesCost + opexCost + laborCost;
  const netProfit = totalRevenue - totalCosts;

  // 6. Target Progress
  const target = settings.monthlyTarget; // Simple target comparison for now
  const gapToTarget = target - totalRevenue;
  
  // Remaining days (only relevant for 'this_month')
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const remainingDays = dateRange.type === 'this_month' ? Math.max(0, daysInMonth - new Date().getDate()) : 0;
  const dailyNeeded = remainingDays > 0 && gapToTarget > 0 ? Math.ceil(gapToTarget / remainingDays) : 0;

  // --- RFM Helpers ---
  const getCustomerStats = (cid: string) => {
    // Look at last 12 months for RFM generally, but we can filter simply
    const cJobs = jobs.filter(j => j.customerId === cid && j.status === JobStatus.COMPLETED);
    const totalSpent = cJobs.reduce((sum, j) => sum + (j.financial?.total_amount || j.totalPaid || 0), 0);
    const lastJobDate = cJobs.sort((a,b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0]?.serviceDate;
    
    const diffTime = lastJobDate ? Math.abs(new Date().getTime() - new Date(lastJobDate).getTime()) : 0;
    const daysSince = lastJobDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 9999;

    return { totalSpent, jobCount: cJobs.length, lastJobDate, daysSince };
  };

  const topCustomers = React.useMemo(() => {
    return customers.map(c => ({...c, ...getCustomerStats(c.customer_id)}))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [customers, jobs]);

  // --- Components ---

  const StatCard = ({ label, value, sub, icon: Icon, colorClass, borderClass }: any) => (
    <div className={`bg-white p-5 rounded-3xl border-2 ${borderClass} shadow-sm relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${colorClass} opacity-10`}>
        <Icon size={40} />
      </div>
      <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
        <Icon size={14} /> {label}
      </div>
      <div className="text-3xl font-black text-[#5d4a36] tracking-tight">{value}</div>
      {sub && <div className="text-xs font-bold text-slate-400 mt-1">{sub}</div>}
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

  // --- Modals ---

  const SettingsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl border-4 border-[#e8dcb9]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-[#5d4a36] flex items-center gap-2"><Settings size={20}/> 系統參數設定</h3>
          <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 rounded-full"><XCircle size={24}/></button>
        </div>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#b59a7a]">每月營收目標</label>
            <input type="number" className="input-nook" value={settings.monthlyTarget} onChange={e => setSettings({...settings, monthlyTarget: parseInt(e.target.value)||0})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#b59a7a]">每月固定人力成本 (合計)</label>
            <input type="number" className="input-nook" value={settings.monthlySalary} onChange={e => setSettings({...settings, monthlySalary: parseInt(e.target.value)||0})} />
          </div>
          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 space-y-3">
            <div className="text-xs font-black text-orange-400">耗材成本設定</div>
            <div>
              <label className="text-[10px] font-bold text-slate-500">檸檬酸 (每罐成本)</label>
              <input type="number" className="input-nook py-1 text-sm" value={settings.consumables.citricCostPerCan} onChange={e => setSettings({...settings, consumables: {...settings.consumables, citricCostPerCan: parseInt(e.target.value)||0}})} />
            </div>
            <div className="flex gap-2">
               <div className="flex-1">
                 <label className="text-[10px] font-bold text-slate-500">藥劑 (每桶進價)</label>
                 <input type="number" className="input-nook py-1 text-sm" value={settings.consumables.chemicalDrumCost} onChange={e => setSettings({...settings, consumables: {...settings.consumables, chemicalDrumCost: parseInt(e.target.value)||0}})} />
               </div>
               <div className="flex-1">
                 <label className="text-[10px] font-bold text-slate-500">每桶可分裝幾罐</label>
                 <input type="number" className="input-nook py-1 text-sm" value={settings.consumables.chemicalDrumToBottles} onChange={e => setSettings({...settings, consumables: {...settings.consumables, chemicalDrumToBottles: parseInt(e.target.value)||0}})} />
               </div>
            </div>
            <div className="text-right text-[10px] text-orange-500 font-bold">
               = 藥劑每罐成本 ${Math.round(settings.consumables.chemicalDrumCost / settings.consumables.chemicalDrumToBottles)}
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => { db.settings.save(settings); setShowSettings(false); refreshData(); }}
          className="w-full mt-6 bg-[#78b833] text-white py-3 rounded-xl font-black shadow-lg active:scale-95"
        >
          儲存設定
        </button>
      </div>
    </div>
  );

  const AddExpenseModal = () => {
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
        createdAt: new Date().toISOString()
      };
      db.expenses.save(newExp);
      refreshData();
      setShowAddExpense(false);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border-4 border-[#e8dcb9]">
          <h3 className="text-xl font-black text-[#5d4a36] mb-4">記一筆支出</h3>
          <div className="space-y-3">
             <input type="date" className="input-nook" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
             <select className="input-nook" value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                <option value="insurance">勞健保</option>
                <option value="utilities">公司水電</option>
                <option value="phone">電話費</option>
                <option value="fuel">油資</option>
                <option value="other">其他雜支</option>
             </select>
             <input type="number" placeholder="$ 金額" className="input-nook text-xl" value={form.amount || ''} onChange={e => setForm({...form, amount: parseInt(e.target.value)})} />
             <input type="text" placeholder="備註 (選填)" className="input-nook" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setShowAddExpense(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-500">取消</button>
            <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-[#78b833] text-white font-black shadow-lg">儲存</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-in fade-in">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
            <Activity className="text-[#78b833]" size={40} /> 老闆戰情室 <span className="text-sm bg-yellow-400 text-white px-2 py-0.5 rounded-lg">v2.0</span>
          </h1>
          <p className="text-[#b59a7a] font-bold mt-2">
            掌握真實獲利，決策更有底氣
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['this_month', 'last_month', 'last_7d', 'last_30d'] as RangeType[]).map(type => (
            <button 
              key={type}
              onClick={() => handleRangeChange(type)}
              className={`px-3 py-2 rounded-xl text-xs font-black border-2 whitespace-nowrap transition-all ${
                dateRange.type === type 
                ? 'bg-[#5d4a36] border-[#5d4a36] text-white shadow-md' 
                : 'bg-white border-[#e8dcb9] text-[#b59a7a] hover:bg-[#fffdf5]'
              }`}
            >
              {type === 'this_month' ? '本月' : type === 'last_month' ? '上月' : type === 'last_7d' ? '近7天' : '近30天'}
            </button>
          ))}
          <button onClick={() => setShowSettings(true)} className="px-3 py-2 rounded-xl bg-white border-2 border-[#e8dcb9] text-[#b59a7a] hover:text-[#78b833]">
             <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="bg-[#fffbf0] border-l-4 border-[#78b833] p-3 text-xs font-bold text-[#b59a7a] flex justify-between items-center">
         <span>統計區間：{dateRange.start.toLocaleDateString()} ~ {dateRange.end.toLocaleDateString()} ({daysInView} 天)</span>
         {activeTab === 'expenses' && (
           <button onClick={() => setShowAddExpense(true)} className="bg-[#78b833] text-white px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm active:scale-95">
             <Plus size={14}/> 記一筆
           </button>
         )}
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
           borderClass="border-red-300"
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
         <div className="bg-white p-5 rounded-3xl border-2 border-[#e8dcb9] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div>
                 <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><Target size={14}/> 月目標進度</div>
                 <div className="text-xl font-black text-[#5d4a36]">${totalRevenue.toLocaleString()} <span className="text-xs text-slate-300">/ {settings.monthlyTarget/1000}k</span></div>
               </div>
               <div className={`px-2 py-1 rounded text-xs font-black ${gapToTarget > 0 ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600'}`}>
                 {gapToTarget > 0 ? `${Math.round((totalRevenue/target)*100)}%` : '達成'}
               </div>
            </div>
            {dateRange.type === 'this_month' && gapToTarget > 0 && (
               <div className="mt-2 text-[10px] text-slate-400">
                  剩 {remainingDays} 天，每天需做 <span className="font-bold text-[#5d4a36]">${dailyNeeded.toLocaleString()}</span>
               </div>
            )}
         </div>
      </div>

      {/* 3. Main Tables Area */}
      <div className="bg-white rounded-[2.5rem] shadow-lg border-2 border-[#e8dcb9] overflow-hidden min-h-[500px]">
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
               className={`flex-1 min-w-[100px] py-4 font-black text-sm flex items-center justify-center gap-2 transition-colors border-b-4 ${
                 activeTab === tab.id ? 'bg-white text-[#5d4a36] border-[#78b833]' : 'text-[#b59a7a] border-transparent hover:bg-[#fffdf5]'
               }`}
             >
               <tab.icon size={16}/> {tab.label}
             </button>
           ))}
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-[#5d4a36] text-sm pl-2">
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
                   csv = ['日期,類別,金額,備註'].join(',') + '\n' + 
                         filteredExpenses.map(e => `${e.date},${e.category},${e.amount},"${e.note}"`).join('\n');
                   downloadCSV(csv, `支出_${dateRange.start.toISOString().slice(0,10)}.csv`);
                }
             }}
             className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-200"
           >
             <Download size={14} /> 匯出報表
           </button>
        </div>

        {/* Content */}
        <div className="overflow-x-auto">
          {activeTab === 'revenue' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">日期</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">客戶</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">項目</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a] text-right">金額</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">付款</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map(job => (
                  <tr key={job.jobId} className="hover:bg-[#f0fdf4]">
                    <td className="p-4 text-xs font-bold text-[#5d4a36] whitespace-nowrap">{job.serviceDate}</td>
                    <td className="p-4 text-xs font-bold text-[#5d4a36]">{job.contactPerson}</td>
                    <td className="p-4 text-xs text-slate-500">{job.serviceItems.join('+')}</td>
                    <td className="p-4 text-xs font-black text-[#78b833] text-right">${(job.financial?.total_amount||0).toLocaleString()}</td>
                    <td className="p-4 text-xs text-slate-400">{job.financial?.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">日期</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">類別</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">備註</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a] text-right">金額</th>
                  <th className="p-4 text-xs font-black text-[#b59a7a]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-300">本區間無支出紀錄</td></tr>}
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-red-50">
                    <td className="p-4 text-xs font-bold text-[#5d4a36] whitespace-nowrap">{exp.date}</td>
                    <td className="p-4 text-xs font-bold text-slate-500 uppercase">{exp.category === 'fuel' ? '⛽ 油資' : exp.category === 'utilities' ? '💡 水電' : exp.category === 'insurance' ? '🏥 勞健保' : exp.category === 'phone' ? '📱 電話' : '📦 雜支'}</td>
                    <td className="p-4 text-xs text-slate-400">{exp.note}</td>
                    <td className="p-4 text-xs font-black text-red-400 text-right">${exp.amount.toLocaleString()}</td>
                    <td className="p-4 text-center">
                       <button onClick={() => { if(confirm('刪除此支出？')) { db.expenses.delete(exp.id); refreshData(); } }} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'consumables' && (
             <div className="p-6">
                <div className="flex gap-4 mb-6">
                   <div className="flex-1 bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                      <div className="text-xs font-bold text-yellow-600 mb-2">檸檬酸總用量</div>
                      <div className="text-2xl font-black text-[#5d4a36]">
                         {filteredJobs.reduce((sum, j) => sum + (j.consumables?.citric_acid??0), 0)} <span className="text-sm text-slate-400">罐</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">成本約 ${filteredJobs.reduce((sum, j) => sum + (j.consumables?.citric_acid??0) * settings.consumables.citricCostPerCan, 0).toLocaleString()}</div>
                   </div>
                   <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-200">
                      <div className="text-xs font-bold text-blue-600 mb-2">藥劑總用量</div>
                      <div className="text-2xl font-black text-[#5d4a36]">
                         {filteredJobs.reduce((sum, j) => sum + (j.consumables?.chemical??0), 0)} <span className="text-sm text-slate-400">罐</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">成本約 ${filteredJobs.reduce((sum, j) => sum + (j.consumables?.chemical??0) * chemicalUnitCost, 0).toLocaleString()}</div>
                   </div>
                </div>
                <table className="w-full text-left border-collapse border border-slate-100 rounded-xl">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="p-3 text-xs font-bold">工單日期</th>
                         <th className="p-3 text-xs font-bold">客戶</th>
                         <th className="p-3 text-xs font-bold text-right">檸檬酸</th>
                         <th className="p-3 text-xs font-bold text-right">藥劑</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredJobs.slice(0, 10).map(j => (
                         <tr key={j.jobId}>
                            <td className="p-3 text-xs">{j.serviceDate}</td>
                            <td className="p-3 text-xs text-slate-500">{j.contactPerson}</td>
                            <td className="p-3 text-xs text-right font-mono">{j.consumables?.citric_acid}</td>
                            <td className="p-3 text-xs text-right font-mono">{j.consumables?.chemical}</td>
                         </tr>
                      ))}
                      {filteredJobs.length > 10 && <tr><td colSpan={4} className="p-3 text-center text-xs text-slate-400">...僅顯示前 10 筆...</td></tr>}
                   </tbody>
                </table>
             </div>
          )}

          {activeTab === 'rfm' && (
             <div className="p-0">
               <div className="p-4 bg-orange-50 border-b border-orange-100 text-xs font-bold text-orange-600 flex gap-2">
                  <ShieldCheck size={16}/> 顯示累積消費最高的 Top 10 客戶（全時期統計）
               </div>
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50">
                   <tr>
                     <th className="p-4 text-xs font-black text-[#b59a7a]">排名</th>
                     <th className="p-4 text-xs font-black text-[#b59a7a]">客戶</th>
                     <th className="p-4 text-xs font-black text-[#b59a7a] text-right">累積消費</th>
                     <th className="p-4 text-xs font-black text-[#b59a7a] text-center">次數</th>
                     <th className="p-4 text-xs font-black text-[#b59a7a]">最近消費</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {topCustomers.map((c, idx) => (
                     <tr key={c.customer_id} className="hover:bg-[#fff7ed]">
                       <td className="p-4 text-xs font-black text-[#b59a7a] w-12 text-center">#{idx+1}</td>
                       <td className="p-4 text-xs font-bold text-[#5d4a36]">
                         {c.displayName}
                         {c.totalSpent > 20000 && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">VIP</span>}
                       </td>
                       <td className="p-4 text-xs font-black text-orange-400 text-right font-mono">${c.totalSpent.toLocaleString()}</td>
                       <td className="p-4 text-xs text-center">{c.jobCount}</td>
                       <td className="p-4 text-xs text-slate-400">{c.lastJobDate || '無'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal />}
      {showAddExpense && <AddExpenseModal />}
    </div>
  );
};

export default BossDashboard;

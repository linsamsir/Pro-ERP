
import React from 'react';
import { db } from '../services/db';
import { Job, Expense, AppSettings, L2LaborConfig } from '../types';
import { auth } from '../services/auth';
import ChatExpenseModal from './ChatExpenseModal';
// Import icons
import { 
  TrendingUp, DollarSign, Activity, Settings, Zap, AlertTriangle, Loader2, Plus, Trash2, Tag, Save, X, MoreHorizontal, Calendar
} from 'lucide-react';

interface BossDashboardProps {
  onNavigate?: (view: string) => void;
}

const BossDashboard: React.FC<BossDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showExpenseModal, setShowExpenseModal] = React.useState(false);
  const [showDateMenu, setShowDateMenu] = React.useState(false);
  
  // Date Range State
  const [rangeType, setRangeType] = React.useState<'this_month' | 'prev_month' | 'next_month' | 'this_year' | 'last_year'>('this_month');
  const [rangeLabel, setRangeLabel] = React.useState('本月');

  // Tabs State
  const [activeTab, setActiveTab] = React.useState<'jobs' | 'expenses'>('jobs');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Expense inline editing
  const [editingExpId, setEditingExpId] = React.useState<string | null>(null);
  const [editExpForm, setEditExpForm] = React.useState<Partial<Expense>>({});

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      let start: Date, end: Date;

      if (rangeType === 'this_month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setRangeLabel('本月');
      } else if (rangeType === 'prev_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        setRangeLabel('上月');
      } else if (rangeType === 'next_month') {
        start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        setRangeLabel('下月');
      } else if (rangeType === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 12, 0);
        setRangeLabel('今年');
      } else { // last_year
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 12, 0);
        setRangeLabel('去年');
      }

      const sStr = start.toLocaleDateString('en-CA');
      const eStr = end.toLocaleDateString('en-CA');

      const summary = await db.dashboard.getSummary(sStr, eStr);
      setData(summary);
    } catch (e: any) {
      console.error("Dashboard error", e);
      setError(e.message || "儀表板載入失敗");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refreshData();
  }, [rangeType]);

  const handleRangeChange = (type: typeof rangeType) => {
    setRangeType(type);
    setShowDateMenu(false);
  };

  const maskedVal = (val: number) => auth.maskSensitiveData(val.toLocaleString(), 'money');

  const scrollToTabs = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Inline Expense Actions
  const handleDeleteExp = async (id: string) => {
    if (!confirm("確定要刪除此筆支出？")) return;
    await db.expenses.delete(id);
    refreshData();
  };

  const startEditExp = (e: Expense) => {
    setEditingExpId(e.id);
    setEditExpForm({ ...e });
  };

  const saveEditExp = async () => {
    if (!editExpForm.id) return;
    await db.expenses.save(editExpForm as Expense);
    setEditingExpId(null);
    refreshData();
  };

  if (loading) return <div className="p-20 text-center"><Loader2 size={40} className="animate-spin mx-auto text-[#78b833]"/></div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-pop relative">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-h1 flex items-center gap-3">
            <Activity className="text-[#78b833]" size={36} /> 老闆戰情室
          </h1>
        </div>
        <div className="flex gap-2 relative">
           <button onClick={() => setShowExpenseModal(true)} className="px-4 py-2 rounded-xl font-bold bg-[#78b833] text-white shadow-md flex items-center gap-2 hover:bg-[#5a8d26] active:translate-y-1 transition-all">
             <Plus size={20}/> <span className="hidden sm:inline">記一筆</span>
           </button>
           
           <button onClick={() => handleRangeChange('this_month')} className={`px-4 py-2 rounded-xl font-bold border-2 ${rangeType==='this_month' ? 'bg-[#5d4a36] text-white' : 'bg-white'}`}>
             本月
           </button>
           
           <div className="relative">
             <button onClick={() => setShowDateMenu(!showDateMenu)} className={`px-4 py-2 rounded-xl font-bold border-2 flex items-center gap-2 ${rangeType!=='this_month' ? 'bg-[#5d4a36] text-white' : 'bg-white'}`}>
               {rangeType!=='this_month' ? rangeLabel : <MoreHorizontal size={20}/>}
             </button>
             
             {showDateMenu && (
               <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border-2 border-[#e8dcb9] w-48 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                 <div className="p-2 space-y-1">
                   {[
                     { id: 'prev_month', label: '上個月' },
                     { id: 'next_month', label: '下個月' },
                     { id: 'this_year', label: '今年累計' },
                     { id: 'last_year', label: '去年累計' },
                   ].map(opt => (
                     <button
                       key={opt.id}
                       onClick={() => handleRangeChange(opt.id as any)}
                       className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm hover:bg-[#fbf8e6] ${rangeType === opt.id ? 'bg-[#78b833] text-white hover:bg-[#5a8d26]' : 'text-[#5d4a36]'}`}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {showExpenseModal && (
        <ChatExpenseModal 
          onClose={() => setShowExpenseModal(false)}
          onSaved={() => {
            setShowExpenseModal(false);
            refreshData(); // Refresh dashboard numbers immediately
          }}
        />
      )}

      {error && (
        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 flex items-center gap-4 text-red-600">
           <AlertTriangle size={32}/>
           <div>
              <div className="font-black text-lg">讀取錯誤</div>
              <div className="text-sm">{error}</div>
           </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="ac-card bg-[#78b833] text-white border-none cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => { setActiveTab('jobs'); scrollToTabs(); }}>
              <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingUp size={20}/> {rangeLabel}營收 (點擊查看)</div>
              <div className="text-4xl font-black">${maskedVal(data.revenue)}</div>
              <div className="mt-2 text-sm font-bold opacity-70">{data.jobCount} 張工單</div>
           </div>
           
           <div className="ac-card bg-red-400 text-white border-none cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => { setActiveTab('expenses'); scrollToTabs(); }}>
              <div className="flex items-center gap-2 mb-2 opacity-80"><Zap size={20}/> {rangeLabel}總支出 (點擊查看)</div>
              <div className="text-4xl font-black">${maskedVal(data.cost)}</div>
              <div className="mt-2 text-sm font-bold opacity-70">{data.expenseCount} 筆費用 (不含純現金流)</div>
           </div>

           <div className="ac-card bg-[#e8dcb9] text-[#5d4a36] border-none">
              <div className="flex items-center gap-2 mb-2 opacity-80"><DollarSign size={20}/> {rangeLabel}淨利</div>
              <div className="text-4xl font-black">${maskedVal(data.netProfit)}</div>
           </div>
        </div>
      )}

      {/* Tabs & Table Section */}
      <div ref={scrollRef} className="bg-white rounded-[2rem] border-2 border-[#e8dcb9] overflow-hidden min-h-[500px]">
         {/* Tabs Header */}
         <div className="flex border-b border-[#e8dcb9] bg-[#fffdf5]">
            <button 
              onClick={() => setActiveTab('jobs')}
              className={`flex-1 py-4 text-center font-bold transition-colors ${activeTab === 'jobs' ? 'bg-white text-[#5d4a36] border-b-4 border-[#78b833]' : 'text-slate-400 hover:bg-[#fffbf0]'}`}
            >
              <span className="hidden sm:inline">{rangeLabel}</span>完工紀錄
            </button>
            <button 
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-4 text-center font-bold transition-colors ${activeTab === 'expenses' ? 'bg-white text-[#5d4a36] border-b-4 border-red-400' : 'text-slate-400 hover:bg-[#fffbf0]'}`}
            >
              <span className="hidden sm:inline">{rangeLabel}</span>支出紀錄
            </button>
         </div>

         {/* Content */}
         {activeTab === 'jobs' && (
           <>
             {data?.recentJobs?.length > 0 ? (
               <table className="w-full text-left">
                  <thead className="bg-[#fffdf5]">
                     <tr>
                        <th className="p-4 text-sm text-[#b59a7a]">日期</th>
                        <th className="p-4 text-sm text-[#b59a7a]">客戶</th>
                        <th className="p-4 text-sm text-[#b59a7a] text-right">金額</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {data.recentJobs.map((j: Job) => (
                        <tr key={j.jobId}>
                           <td className="p-4 font-bold text-[#5d4a36]">{j.serviceDate}</td>
                           <td className="p-4 text-sm font-bold text-slate-500">{j.contactPerson}</td>
                           <td className="p-4 font-black text-right text-[#78b833]">${maskedVal(j.financial?.total_amount || j.totalPaid || 0)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
             ) : (
               <div className="p-10 text-center text-slate-300">本區間尚無完工資料</div>
             )}
           </>
         )}

         {activeTab === 'expenses' && (
           <>
             {data?.recentExpenses?.length > 0 ? (
               <table className="w-full text-left">
                  <thead className="bg-[#fffdf5]">
                     <tr>
                        <th className="p-4 text-sm text-[#b59a7a]">日期</th>
                        <th className="p-4 text-sm text-[#b59a7a]">類別 / 備註</th>
                        <th className="p-4 text-sm text-[#b59a7a] text-right">金額</th>
                        <th className="p-4 w-10"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {data.recentExpenses.map((e: Expense) => (
                        <tr key={e.id} className={e.cashflowOnly ? 'bg-slate-50' : ''}>
                           {editingExpId === e.id ? (
                              <>
                                <td className="p-2"><input type="date" className="input-nook py-1 text-xs" value={editExpForm.date} onChange={ev => setEditExpForm({...editExpForm, date: ev.target.value})} /></td>
                                <td className="p-2"><input className="input-nook py-1 text-xs" value={editExpForm.note} onChange={ev => setEditExpForm({...editExpForm, note: ev.target.value})} /></td>
                                <td className="p-2 text-right"><input type="number" className="input-nook py-1 text-xs text-right w-20 ml-auto" value={editExpForm.amount} onChange={ev => setEditExpForm({...editExpForm, amount: parseInt(ev.target.value)})} /></td>
                                <td className="p-2 flex gap-1 justify-end">
                                   <button onClick={saveEditExp} className="p-1 bg-green-100 text-green-600 rounded"><Save size={16}/></button>
                                   <button onClick={() => setEditingExpId(null)} className="p-1 bg-slate-100 text-slate-400 rounded"><X size={16}/></button>
                                </td>
                              </>
                           ) : (
                              <>
                                <td className="p-4 font-bold text-slate-500 whitespace-nowrap text-sm">{e.date}</td>
                                <td className="p-4">
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] px-2 py-0.5 rounded border bg-white">{e.category}</span>
                                      <span className="font-bold text-[#5d4a36] line-clamp-1">{e.note || '-'}</span>
                                   </div>
                                </td>
                                <td className={`p-4 font-mono font-black text-right ${e.cashflowOnly ? 'text-slate-400 line-through decoration-slate-300' : 'text-red-500'}`}>
                                   ${maskedVal(e.amount)}
                                </td>
                                <td className="p-4 text-right">
                                   <div className="flex gap-1 justify-end">
                                      <button onClick={() => startEditExp(e)} className="text-slate-300 hover:text-blue-500"><Tag size={16}/></button>
                                      <button onClick={() => handleDeleteExp(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                   </div>
                                </td>
                              </>
                           )}
                        </tr>
                     ))}
                  </tbody>
               </table>
             ) : (
               <div className="p-10 text-center text-slate-300">本區間尚無支出資料</div>
             )}
           </>
         )}
      </div>
    </div>
  );
};

export default BossDashboard;

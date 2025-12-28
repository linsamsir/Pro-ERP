
import React from 'react';
import { db } from '../services/db';
import { Job, Expense, AppSettings, L2LaborConfig } from '../types';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import ChatExpenseModal from './ChatExpenseModal';
import ExpenseManager from './ExpenseManager'; // Import new component
import { 
  TrendingUp, DollarSign, Target, Activity, CheckCircle2,
  Settings, Zap, AlertTriangle, Loader2, Plus, List
} from 'lucide-react';

const BossDashboard: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rangeType, setRangeType] = React.useState('this_month');
  const [showExpenseModal, setShowExpenseModal] = React.useState(false);
  const [showExpenseManager, setShowExpenseManager] = React.useState(false); // New state
  
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      let start = new Date(now.getFullYear(), now.getMonth(), 1);
      let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      if (rangeType === 'last_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      // Convert to string for query
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

  const maskedVal = (val: number) => auth.maskSensitiveData(val.toLocaleString(), 'money');

  if (loading) return <div className="p-20 text-center"><Loader2 size={40} className="animate-spin mx-auto text-[#78b833]"/></div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-pop">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-h1 flex items-center gap-3">
            <Activity className="text-[#78b833]" size={36} /> 老闆戰情室
          </h1>
        </div>
        <div className="flex gap-2">
           {/* New Button for Expense Manager */}
           <button onClick={() => setShowExpenseManager(true)} className="px-4 py-2 rounded-xl font-bold border-2 border-red-200 text-red-500 bg-red-50 flex items-center gap-2 hover:bg-red-100">
             <List size={20}/> 支出管理
           </button>
           
           <button onClick={() => setShowExpenseModal(true)} className="px-4 py-2 rounded-xl font-bold bg-[#78b833] text-white shadow-md flex items-center gap-2 hover:bg-[#5a8d26] active:translate-y-1 transition-all">
             <Plus size={20}/> 記一筆
           </button>
           <button onClick={() => setRangeType('this_month')} className={`px-4 py-2 rounded-xl font-bold border-2 ${rangeType==='this_month' ? 'bg-[#5d4a36] text-white' : 'bg-white'}`}>本月</button>
           <button onClick={() => setRangeType('last_month')} className={`px-4 py-2 rounded-xl font-bold border-2 ${rangeType==='last_month' ? 'bg-[#5d4a36] text-white' : 'bg-white'}`}>上月</button>
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

      {/* Render Expense Manager Overlay */}
      {showExpenseManager && (
        <ExpenseManager onClose={() => {
          setShowExpenseManager(false);
          refreshData(); // Refresh numbers on close
        }} />
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
           <div className="ac-card bg-[#78b833] text-white border-none">
              <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingUp size={20}/> 區間營收</div>
              <div className="text-4xl font-black">${maskedVal(data.revenue)}</div>
              <div className="mt-2 text-sm font-bold opacity-70">{data.jobCount} 張工單</div>
           </div>
           
           <div className="ac-card bg-red-400 text-white border-none cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setShowExpenseManager(true)}>
              <div className="flex items-center gap-2 mb-2 opacity-80"><Zap size={20}/> 總支出 (點擊管理)</div>
              <div className="text-4xl font-black">${maskedVal(data.cost)}</div>
              <div className="mt-2 text-sm font-bold opacity-70">{data.expenseCount} 筆費用 (不含純現金流)</div>
           </div>

           <div className="ac-card bg-[#e8dcb9] text-[#5d4a36] border-none">
              <div className="flex items-center gap-2 mb-2 opacity-80"><DollarSign size={20}/> 淨利</div>
              <div className="text-4xl font-black">${maskedVal(data.netProfit)}</div>
           </div>
        </div>
      )}

      {/* Recent Jobs Table */}
      <div className="bg-white rounded-[2rem] border-2 border-[#e8dcb9] overflow-hidden">
         <div className="p-5 bg-slate-50 border-b border-slate-100 font-bold text-[#5d4a36]">
            近期完工紀錄
         </div>
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
           <div className="p-10 text-center text-slate-300">本區間尚無資料</div>
         )}
      </div>
    </div>
  );
};

export default BossDashboard;

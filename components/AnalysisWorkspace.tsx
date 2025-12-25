
import React from 'react';
import { db } from '../services/db';
import { L2Engine, L2JobAnalysis } from '../services/l2Engine';
import { Job, L2Asset, L2StockLog, L2LaborConfig, JobStatus } from '../types';
import { 
  PieChart, Truck, Package, TrendingUp, Download, 
  Calendar, ArrowRight, Eye, EyeOff, Plus, Trash2, RefreshCw
} from 'lucide-react';

type Tab = 'dashboard' | 'assets' | 'stock';

const AnalysisWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');
  const [isDemo, setIsDemo] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Data State
  const [l2Assets, setL2Assets] = React.useState<L2Asset[]>([]);
  const [l2Stock, setL2Stock] = React.useState<L2StockLog[]>([]);
  const [l2Labor, setL2Labor] = React.useState<L2LaborConfig>(db.l2.labor.get());
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [analyzedJobs, setAnalyzedJobs] = React.useState<L2JobAnalysis[]>([]);

  // Forms
  const [newAsset, setNewAsset] = React.useState<Partial<L2Asset>>({ name: '', cost: 0, purchaseDate: new Date().toLocaleDateString('en-CA'), lifespanMonths: 24 });
  const [newStock, setNewStock] = React.useState<Partial<L2StockLog>>({ itemType: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldPerUnit: 20 });

  const refresh = () => {
    setL2Assets(db.l2.assets.getAll());
    setL2Stock(db.l2.stock.getAll());
    setL2Labor(db.l2.labor.get());
    setJobs(db.jobs.getAll());
  };

  React.useEffect(() => {
    refresh();
  }, []);

  // Analysis Effect
  React.useEffect(() => {
    const monthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const monthlyJobs = jobs.filter(j => j.status === JobStatus.COMPLETED && j.serviceDate.startsWith(monthPrefix));
    
    // 1. Prepare Parameters
    const unitCosts = L2Engine.getConsumableUnitCosts(l2Stock);
    const monthlyDepreciation = L2Engine.getMonthlyDepreciation(l2Assets, currentDate);
    const trafficCostPerMin = L2Engine.getTrafficCostPerMinute(db.expenses.getAll(), jobs, monthPrefix);
    const totalWorkHours = monthlyJobs.reduce((sum, j) => sum + (j.workDurationHours || 0), 0);

    // 2. Run Analysis for each job
    const results = monthlyJobs.map(job => 
      L2Engine.analyzeJob(job, l2Labor, unitCosts, monthlyDepreciation, trafficCostPerMin, totalWorkHours)
    );

    setAnalyzedJobs(results.sort((a,b) => new Date(b.job.serviceDate).getTime() - new Date(a.job.serviceDate).getTime()));
  }, [jobs, l2Assets, l2Stock, l2Labor, currentDate]);

  const toggleDemo = () => setIsDemo(!isDemo);

  const formatMoney = (n: number) => {
    if (isDemo) return "$****";
    return `$${Math.round(n).toLocaleString()}`;
  };

  const changeMonth = (delta: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  };

  // Handlers
  const handleAddAsset = () => {
    if(!newAsset.name) return;
    db.l2.assets.save({ ...newAsset, id: `L2A-${Date.now()}`, status: 'active' } as L2Asset);
    setNewAsset({ name: '', cost: 0, purchaseDate: new Date().toLocaleDateString('en-CA'), lifespanMonths: 24 });
    refresh();
  };

  const handleAddStock = () => {
    if(!newStock.totalCost) return;
    db.l2.stock.save({ ...newStock, id: `L2S-${Date.now()}`, date: new Date().toLocaleDateString('en-CA') } as L2StockLog);
    setNewStock({ itemType: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldPerUnit: 20 });
    refresh();
  };

  const exportCSV = () => {
    const header = "日期,工單號,客戶,總收入,人力成本,耗材成本,折舊攤提,交通攤提,總成本,真實毛利\n";
    const rows = analyzedJobs.map(a => 
      `${a.job.serviceDate},${a.job.jobId},${a.job.contactPerson},${a.revenue},${Math.round(a.costs.labor)},${Math.round(a.costs.consumables)},${Math.round(a.costs.depreciation)},${Math.round(a.costs.traffic)},${Math.round(a.costs.total)},${Math.round(a.realGrossMargin)}`
    ).join("\n");
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `L2_Analysis_${currentDate.getMonth()+1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tab Definitions with Dual Naming Strategy
  const tabs = [
    { id: 'dashboard', icon: TrendingUp, label: '損益分析總覽', mobileLabel: '損益' },
    { id: 'assets', icon: Truck, label: '設備資產清冊', mobileLabel: '設備' },
    { id: 'stock', icon: Package, label: '耗材進貨登記', mobileLabel: '耗材' }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-pop">
      
      {/* 1. Header & Controls (Unified with BossDashboard Style) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-h1 flex items-center gap-3">
            <PieChart className="text-[#78b833]" size={36} /> 進階分析
          </h1>
          <p className="text-note font-bold mt-2 ml-1">
            深入拆解成本結構與獲利能力
          </p>
        </div>
        <div className="flex gap-2">
           {/* Month Selector */}
           <div className="flex items-center bg-white p-1 rounded-xl border-2 border-[#e8dcb9] shadow-sm">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ArrowRight className="rotate-180" size={20}/></button>
              <span className="text-lg font-black text-[#5d4a36] px-4 min-w-[140px] text-center">
                 {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ArrowRight size={20}/></button>
           </div>
           
           <button onClick={toggleDemo} className="p-3 bg-white border-2 border-[#e8dcb9] rounded-xl text-slate-400 hover:text-[#5d4a36]">
              {isDemo ? <EyeOff size={20}/> : <Eye size={20}/>}
           </button>
        </div>
      </div>

      {/* 2. Main Tabs Container */}
      <div className="bg-white rounded-[2rem] shadow-lg border-2 border-[#e8dcb9] overflow-hidden min-h-[600px]">
        {/* Horizontal Tabs */}
        <div className="flex border-b border-[#e8dcb9] bg-[#fbf8e6] overflow-x-auto">
           {tabs.map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as Tab)}
               className={`flex-1 min-w-0 md:min-w-[140px] tab-btn justify-center px-1 md:px-4 ${
                 activeTab === tab.id ? 'active' : ''
               }`}
             >
               <tab.icon size={18} className="shrink-0"/> 
               {/* Mobile Label */}
               <span className="inline md:hidden">{tab.mobileLabel}</span>
               {/* Desktop Label */}
               <span className="hidden md:inline">{tab.label}</span>
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-pop">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="ac-card border-l-8 border-l-[#78b833]">
                     <div className="text-note mb-1">本月總營收</div>
                     <div className="text-4xl font-black text-[#5d4a36]">{formatMoney(analyzedJobs.reduce((s, a) => s + a.revenue, 0))}</div>
                  </div>
                  <div className="ac-card border-l-8 border-l-red-400">
                     <div className="text-note mb-1">總真實成本 (含攤提)</div>
                     <div className="text-4xl font-black text-red-500">{formatMoney(analyzedJobs.reduce((s, a) => s + a.costs.total, 0))}</div>
                     <div className="text-sm text-slate-400 font-bold mt-2">含人力/耗材/折舊/油資</div>
                  </div>
                  <div className="ac-card border-l-8 border-l-blue-400">
                     <div className="text-note mb-1">真實淨利</div>
                     <div className="text-4xl font-black text-blue-600">{formatMoney(analyzedJobs.reduce((s, a) => s + a.realGrossMargin, 0))}</div>
                  </div>
               </div>

               <div className="bg-white rounded-[1.5rem] border border-[#e8dcb9] overflow-hidden">
                  <div className="p-5 border-b border-[#e8dcb9] bg-[#fffbf0] flex justify-between items-center">
                     <div>
                        <h3 className="text-h3 text-[#5d4a36]">單案獲利能力分析</h3>
                        <p className="text-note mt-1">此表為動態運算，不影響原始工單資料</p>
                     </div>
                     <button onClick={exportCSV} className="px-4 py-2 rounded-xl bg-[#78b833] text-white font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-[#5a8d26]">
                        <Download size={16}/> 匯出 CSV
                     </button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-wider">
                           <tr>
                              <th className="p-5">日期 / 客戶</th>
                              <th className="p-5 text-right">收入</th>
                              <th className="p-5 text-right text-red-300">人力</th>
                              <th className="p-5 text-right text-red-300">耗材</th>
                              <th className="p-5 text-right text-red-300">折舊</th>
                              <th className="p-5 text-right text-red-300">交通</th>
                              <th className="p-5 text-right">真實毛利</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm font-bold">
                           {analyzedJobs.map((a, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5">
                                   <div className="text-[#5d4a36] text-base">{a.job.serviceDate}</div>
                                   <div className="text-xs text-slate-400 mt-1">{isDemo ? '客戶***' : a.job.contactPerson}</div>
                                </td>
                                <td className="p-5 text-right text-[#5d4a36] text-base">{formatMoney(a.revenue)}</td>
                                <td className="p-5 text-right text-slate-400">-{Math.round(a.costs.labor)}</td>
                                <td className="p-5 text-right text-slate-400">-{Math.round(a.costs.consumables)}</td>
                                <td className="p-5 text-right text-slate-400">-{Math.round(a.costs.depreciation)}</td>
                                <td className="p-5 text-right text-slate-400">-{Math.round(a.costs.traffic)}</td>
                                <td className={`p-5 text-right font-black text-base ${a.realGrossMargin > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                   {formatMoney(a.realGrossMargin)}
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          )}

          {/* TAB 2: ASSETS */}
          {activeTab === 'assets' && (
             <div className="space-y-6 animate-pop">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 text-sm font-bold text-orange-800 flex items-center justify-between">
                   <span>💡 第一次使用？建議載入預設資產表。</span>
                   <button onClick={() => { db.l2.assets.seed(); refresh(); }} className="bg-white border px-3 py-1 rounded-lg text-xs shadow-sm active:scale-95 text-[#5d4a36]">
                      <RefreshCw size={12} className="inline mr-1"/> 載入預設值
                   </button>
                </div>

                <div className="ac-card card-highlight">
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <input className="input-nook py-3 col-span-2" placeholder="設備名稱" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} />
                      <input className="input-nook py-3" type="number" placeholder="成本" value={newAsset.cost || ''} onChange={e => setNewAsset({...newAsset, cost: parseInt(e.target.value)})} />
                      <input className="input-nook py-3" type="number" placeholder="壽命(月)" value={newAsset.lifespanMonths} onChange={e => setNewAsset({...newAsset, lifespanMonths: parseInt(e.target.value)})} />
                      <button onClick={handleAddAsset} className="bg-[#78b833] text-white rounded-xl font-black shadow-sm active:translate-y-1"><Plus className="mx-auto"/></button>
                   </div>

                   <div className="space-y-3">
                      {l2Assets.length === 0 && <div className="text-center py-8 text-slate-400 font-bold">尚無資產資料</div>}
                      {l2Assets.map(a => (
                         <div key={a.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div>
                               <div className="text-h3 text-[#5d4a36]">{a.name}</div>
                               <div className="text-xs text-slate-400 font-bold mt-1">購入: {a.purchaseDate} • 壽命 {a.lifespanMonths} 月</div>
                            </div>
                            <div className="flex items-center gap-6">
                               <div className="text-right">
                                  <div className="text-lg font-bold text-[#5d4a36]">${a.cost.toLocaleString()}</div>
                                  <div className="text-xs font-bold text-red-400">月折舊 ${Math.round(a.cost/a.lifespanMonths)}</div>
                               </div>
                               <button onClick={() => { db.l2.assets.delete(a.id); refresh(); }} className="text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {/* TAB 3: STOCK */}
          {activeTab === 'stock' && (
             <div className="space-y-6 animate-pop">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="ac-card card-highlight">
                      <h3 className="text-h3 text-[#5d4a36] mb-4">1. 登記進貨</h3>
                      <div className="space-y-4">
                         <div className="flex gap-3">
                            <select className="input-nook py-3" value={newStock.itemType} onChange={e => setNewStock({...newStock, itemType: e.target.value as any})}>
                               <option value="citric">檸檬酸</option>
                               <option value="chemical">藥劑</option>
                            </select>
                            <input type="number" className="input-nook py-3" placeholder="總成本" value={newStock.totalCost || ''} onChange={e => setNewStock({...newStock, totalCost: parseInt(e.target.value)})} />
                         </div>
                         <div className="flex gap-3">
                            <input type="number" className="input-nook py-3" placeholder="數量(桶/包)" value={newStock.quantity} onChange={e => setNewStock({...newStock, quantity: parseInt(e.target.value)})} />
                            <input type="number" className="input-nook py-3" placeholder="每單位產出罐數" value={newStock.yieldPerUnit} onChange={e => setNewStock({...newStock, yieldPerUnit: parseInt(e.target.value)})} />
                         </div>
                         <button onClick={handleAddStock} className="w-full btn-primary py-3">儲存進貨單</button>
                      </div>
                   </div>
                   
                   <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                      <h3 className="text-h3 text-blue-900 mb-6">2. 目前單位成本 (加權平均)</h3>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
                            <span className="text-body font-bold text-blue-800">🍋 檸檬酸 / 罐</span>
                            <span className="text-3xl font-black text-[#5d4a36]">${Math.round(L2Engine.getConsumableUnitCosts(l2Stock).citricPerCan)}</span>
                         </div>
                         <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
                            <span className="text-body font-bold text-blue-800">🧪 藥劑 / 罐</span>
                            <span className="text-3xl font-black text-[#5d4a36]">${Math.round(L2Engine.getConsumableUnitCosts(l2Stock).chemicalPerCan)}</span>
                         </div>
                         <p className="text-alert mt-2 text-blue-400">
                            * 系統會自動加總所有歷史進貨紀錄，算出平均每罐的真實成本。
                         </p>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[2rem] border-2 border-[#e8dcb9] overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-xs font-black text-slate-400">
                         <tr><th className="p-5">日期</th><th className="p-5">品項</th><th className="p-5 text-right">總成本</th><th className="p-5 text-right">產出罐數</th><th className="p-5"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {l2Stock.map(l => (
                            <tr key={l.id}>
                               <td className="p-5 text-sm font-bold text-slate-500">{l.date}</td>
                               <td className="p-5 text-h3 text-[#5d4a36]">{l.itemType === 'citric' ? '檸檬酸' : '藥劑'}</td>
                               <td className="p-5 text-right font-mono font-bold text-lg">${l.totalCost}</td>
                               <td className="p-5 text-right font-mono font-bold">{l.quantity * l.yieldPerUnit}</td>
                               <td className="p-5 text-right"><button onClick={() => { db.l2.stock.delete(l.id); refresh(); }} className="text-slate-300 hover:text-red-500"><Trash2 size={20}/></button></td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AnalysisWorkspace;

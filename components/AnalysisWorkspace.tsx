
import React from 'react';
import { db } from '../services/db';
import { L2Engine, L2JobAnalysis } from '../services/l2Engine';
import { Job, L2Asset, L2StockLog, L2LaborConfig, JobStatus, Expense } from '../types';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import { 
  PieChart, Truck, Package, TrendingUp, Download, 
  Calendar, ArrowRight, Eye, EyeOff, Plus, Trash2, RefreshCw, HardHat, AlertCircle
} from 'lucide-react';

type Tab = 'dashboard' | 'assets' | 'stock' | 'labor';

const DEFAULT_LABOR: L2LaborConfig = {
  bossSalary: 30000,
  partnerSalary: 30000,
  insuranceCost: 12000
};

const AnalysisWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');
  const [isDemo, setIsDemo] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Data State
  const [l2Assets, setL2Assets] = React.useState<L2Asset[]>([]);
  const [l2Stock, setL2Stock] = React.useState<L2StockLog[]>([]);
  const [l2Labor, setL2Labor] = React.useState<L2LaborConfig>(DEFAULT_LABOR);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [analyzedJobs, setAnalyzedJobs] = React.useState<L2JobAnalysis[]>([]);
  
  // Delete States
  const [deleteTarget, setDeleteTarget] = React.useState<{ type: 'asset' | 'stock', id: string } | null>(null);

  const canWrite = auth.canWrite(); // Permission check for edit buttons

  // Forms
  const [newAsset, setNewAsset] = React.useState<Partial<L2Asset>>({ name: '', cost: 0, purchaseDate: new Date().toLocaleDateString('en-CA'), lifespanMonths: 24 });
  const [newStock, setNewStock] = React.useState<Partial<L2StockLog>>({ itemType: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldPerUnit: 20 });

  const refresh = async () => {
    const [assets, stock, labor, allJobs, allExpenses] = await Promise.all([
        db.l2.assets.getAll(),
        db.l2.stock.getAll(),
        db.l2.labor.get(),
        db.jobs.getAll(),
        db.expenses.getAll()
    ]);
    setL2Assets(assets);
    setL2Stock(stock);
    setL2Labor(labor);
    setJobs(allJobs);
    setExpenses(allExpenses);
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
    const trafficCostPerMin = L2Engine.getTrafficCostPerMinute(expenses, jobs, monthPrefix);
    const totalWorkHours = monthlyJobs.reduce((sum, j) => sum + (j.workDurationHours || 0), 0);

    // 2. Run Analysis for each job
    const results = monthlyJobs.map(job => 
      L2Engine.analyzeJob(job, l2Labor, unitCosts, monthlyDepreciation, trafficCostPerMin, totalWorkHours)
    );

    setAnalyzedJobs(results.sort((a,b) => new Date(b.job.serviceDate).getTime() - new Date(a.job.serviceDate).getTime()));
  }, [jobs, l2Assets, l2Stock, l2Labor, currentDate, expenses]);

  const toggleDemo = () => setIsDemo(!isDemo);

  const formatMoney = (n: number) => {
    if (isDemo) return "$****";
    return `$${auth.maskSensitiveData(Math.round(n).toLocaleString(), 'money')}`;
  };

  const changeMonth = (delta: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  };

  // Handlers
  const handleAddAsset = async () => {
    if(!canWrite) return;
    if(!newAsset.name) return;
    await db.l2.assets.save({ ...newAsset, id: `L2A-${Date.now()}`, status: 'active' } as L2Asset);
    setNewAsset({ name: '', cost: 0, purchaseDate: new Date().toLocaleDateString('en-CA'), lifespanMonths: 24 });
    refresh();
  };

  const handleAddStock = async () => {
    if(!canWrite) return;
    if(!newStock.totalCost) return;
    await db.l2.stock.save({ ...newStock, id: `L2S-${Date.now()}`, date: new Date().toLocaleDateString('en-CA') } as L2StockLog);
    setNewStock({ itemType: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldPerUnit: 20 });
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'asset') {
      await db.l2.assets.delete(deleteTarget.id);
    } else {
      await db.l2.stock.delete(deleteTarget.id);
    }
    refresh();
    setDeleteTarget(null);
  };

  // Tab Definitions with Dual Naming Strategy
  const tabs = [
    { id: 'dashboard', icon: TrendingUp, label: '損益分析總覽', mobileLabel: '損益' },
    { id: 'assets', icon: Truck, label: '設備資產清冊', mobileLabel: '設備' },
    { id: 'stock', icon: Package, label: '耗材進貨登記', mobileLabel: '耗材' },
    { id: 'labor', icon: HardHat, label: '人力設定', mobileLabel: '人力' }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-pop">
      <ConfirmDialog 
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'asset' ? "刪除資產?" : "刪除進貨紀錄?"}
        message="確認刪除此項目。刪除後將影響歷史成本計算。"
        isDanger
        confirmText="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 1. Header & Controls */}
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
               <span className="inline md:hidden">{tab.mobileLabel}</span>
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
                {canWrite && (
                  <div className="ac-card card-highlight">
                     <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <input className="input-nook py-3 col-span-2" placeholder="設備名稱" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} />
                        <input className="input-nook py-3" type="number" placeholder="成本" value={newAsset.cost || ''} onChange={e => setNewAsset({...newAsset, cost: parseInt(e.target.value)})} />
                        <input className="input-nook py-3" type="number" placeholder="壽命(月)" value={newAsset.lifespanMonths} onChange={e => setNewAsset({...newAsset, lifespanMonths: parseInt(e.target.value)})} />
                        <button onClick={handleAddAsset} className="bg-[#78b833] text-white rounded-xl font-black shadow-sm active:translate-y-1"><Plus className="mx-auto"/></button>
                     </div>
                  </div>
                )}

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
                               <div className="text-lg font-bold text-[#5d4a36]">${auth.maskSensitiveData(a.cost.toLocaleString(), 'money')}</div>
                               <div className="text-xs font-bold text-red-400">月折舊 ${auth.maskSensitiveData(Math.round(a.cost/a.lifespanMonths).toLocaleString(), 'money')}</div>
                            </div>
                            {canWrite && <button onClick={() => setDeleteTarget({type: 'asset', id: a.id})} className="text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {/* TAB 3: STOCK */}
          {activeTab === 'stock' && (
             <div className="space-y-6 animate-pop">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {canWrite && (
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
                   )}
                   
                   <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                      <h3 className="text-h3 text-blue-900 mb-6">2. 目前單位成本 (加權平均)</h3>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
                            <span className="text-body font-bold text-blue-800">🍋 檸檬酸 / 罐</span>
                            <span className="text-3xl font-black text-[#5d4a36]">${auth.maskSensitiveData(Math.round(L2Engine.getConsumableUnitCosts(l2Stock).citricPerCan), 'money')}</span>
                         </div>
                         <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
                            <span className="text-body font-bold text-blue-800">🧪 藥劑 / 罐</span>
                            <span className="text-3xl font-black text-[#5d4a36]">${auth.maskSensitiveData(Math.round(L2Engine.getConsumableUnitCosts(l2Stock).chemicalPerCan), 'money')}</span>
                         </div>
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
                               <td className="p-5 text-right font-mono font-bold text-lg">${auth.maskSensitiveData(l.totalCost, 'money')}</td>
                               <td className="p-5 text-right font-mono font-bold">{l.quantity * l.yieldPerUnit}</td>
                               <td className="p-5 text-right">
                                 {canWrite && <button onClick={async () => { await db.l2.stock.delete(l.id); refresh(); }} className="text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {activeTab === 'labor' && (
             <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
                <div className="bg-white p-8 rounded-[2rem] border-2 border-[#e8dcb9] shadow-sm">
                   <h3 className="font-black text-xl text-[#5d4a36] mb-6 flex items-center gap-2"><HardHat className="text-orange-500"/> 固定人力成本</h3>
                   
                   <div className="space-y-4">
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-1 block">老闆月薪</label>
                         <input type="number" className="input-nook py-3 text-lg" value={l2Labor.bossSalary} onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const newCfg = { ...l2Labor, bossSalary: val };
                            setL2Labor(newCfg);
                            db.l2.labor.save(newCfg);
                         }} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-1 block">闆娘月薪</label>
                         <input type="number" className="input-nook py-3 text-lg" value={l2Labor.partnerSalary} onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const newCfg = { ...l2Labor, partnerSalary: val };
                            setL2Labor(newCfg);
                            db.l2.labor.save(newCfg);
                         }} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-1 block">勞健保總負擔</label>
                         <input type="number" className="input-nook py-3 text-lg" value={l2Labor.insuranceCost} onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const newCfg = { ...l2Labor, insuranceCost: val };
                            setL2Labor(newCfg);
                            db.l2.labor.save(newCfg);
                         }} />
                      </div>
                   </div>

                   <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                         <span className="font-black text-slate-400">每月總固定支出</span>
                         <span className="text-3xl font-black text-[#5d4a36]">${(l2Labor.bossSalary + l2Labor.partnerSalary + l2Labor.insuranceCost).toLocaleString()}</span>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-xl mt-4 text-xs font-bold text-orange-600 flex items-start gap-2">
                         <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                         <div>此金額將除以「當月總工時」，算出每小時的人力成本率，再依據每張工單的工時進行攤提。</div>
                      </div>
                   </div>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AnalysisWorkspace;

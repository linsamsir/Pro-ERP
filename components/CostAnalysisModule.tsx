
import React from 'react';
import { db } from '../services/db';
import { L2Asset, L2StockLog, Job, Expense, AppSettings } from '../types';
import { CostEngine, MonthlyCostReport } from '../services/costEngine';
import { DEFAULT_ASSETS } from '../data/defaultAssets'; // Import seed
import { X, PieChart, Package, Truck, HardHat, Receipt, Trash2, Plus, Calendar, Download, ChevronLeft, ChevronRight, AlertCircle, Import } from 'lucide-react';

interface CostAnalysisModuleProps {
  onClose: () => void;
}

type SubTab = 'overview' | 'assets' | 'stock' | 'labor';

const defaultSettings: AppSettings = {
    monthlyTarget: 0,
    monthlySalary: 0,
    consumables: { citricCostPerCan: 0, chemicalDrumCost: 0, chemicalDrumToBottles: 1 }
};

const CostAnalysisModule: React.FC<CostAnalysisModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = React.useState<SubTab>('overview');
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Data
  const [assets, setAssets] = React.useState<L2Asset[]>([]);
  const [stockLogs, setStockLogs] = React.useState<L2StockLog[]>([]);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [report, setReport] = React.useState<MonthlyCostReport | null>(null);
  const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);

  // Forms
  const [showAssetForm, setShowAssetForm] = React.useState(false);
  const [newAsset, setNewAsset] = React.useState<Partial<L2Asset>>({ name: '', cost: 0, lifespanMonths: 24, purchaseDate: new Date().toLocaleDateString('en-CA'), status: 'active', qty: 1, unit: '個' });

  const [showStockForm, setShowStockForm] = React.useState(false);
  const [newStock, setNewStock] = React.useState<Partial<L2StockLog>>({ itemType: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldPerUnit: 20 });

  const refreshData = async () => {
    const [a, s, j, e, set] = await Promise.all([
        db.l2.assets.getAll(),
        db.l2.stock.getAll(),
        db.jobs.getAll(),
        db.expenses.getAll(),
        db.settings.get()
    ]);
    setAssets(a);
    setStockLogs(s);
    setJobs(j);
    setExpenses(e);
    setSettings(set);
  };

  React.useEffect(() => {
    refreshData();
  }, []);

  React.useEffect(() => {
    // Generate Report on data/date change
    const r = CostEngine.generateMonthlyReport(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      jobs,
      expenses,
      assets,
      stockLogs,
      settings
    );
    setReport(r);
  }, [currentDate, assets, stockLogs, settings, jobs, expenses]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  // --- Handlers ---
  const handleAddAsset = async () => {
    if (!newAsset.name) return; // Cost can be 0
    await db.l2.assets.save({ ...newAsset, id: db.l2.assets.generateId() } as L2Asset);
    setShowAssetForm(false);
    refreshData();
  };

  // Import Default Assets Logic - IDEMPOTENT
  const handleImportDefaults = async () => {
    if (!confirm("確定要匯入預設施工設備清單？(重複的項目將自動跳過)")) return;
    
    let count = 0;
    for (const def of DEFAULT_ASSETS) {
      // Check duplicate by name and category (stronger check)
      const exists = assets.some(a => 
        a.name === def.name && 
        a.category === def.category &&
        a.status !== 'retired'
      );
      
      if (!exists) {
        await db.l2.assets.save({
          id: db.l2.assets.generateId(),
          name: def.name || '未命名設備',
          category: def.category || '未分類',
          note: def.note || '',
          qty: def.qty || 1,
          unit: def.unit || '個',
          cost: 0, // Default to 0, user updates later
          lifespanMonths: 24,
          purchaseDate: new Date().toLocaleDateString('en-CA'),
          status: 'active'
        });
        count++;
      }
    }
    alert(`匯入完成！新增了 ${count} 項設備。請記得去編輯「購入金額」。`);
    refreshData();
  };

  const handleAddStock = async () => {
    if (!newStock.quantity || !newStock.totalCost) return;
    await db.l2.stock.save({ ...newStock, id: db.l2.stock.generateId(), date: new Date().toLocaleDateString('en-CA') } as L2StockLog);
    setShowStockForm(false);
    refreshData();
  };

  const downloadReport = () => {
    if (!report) return;
    const bom = '\uFEFF';
    const csvContent = [
      `月份,${report.month}`,
      `總營收,${report.revenue}`,
      `人力成本,${report.costs.labor}`,
      `耗材成本(實際),${Math.round(report.costs.consumables_actual)}`,
      `設備折舊,${Math.round(report.costs.depreciation)}`,
      `其他雜支,${report.costs.overhead}`,
      `總成本,${Math.round(report.costs.total)}`,
      `淨利,${Math.round(report.netProfit)}`
    ].join('\n');
    
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CostReport_${report.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 md:left-72 z-[60] bg-[#fbf8e6] overflow-auto animate-in slide-in-from-bottom-10 shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-[#fffbf0]/95 backdrop-blur-sm p-4 border-b-2 border-[#e8dcb9] flex justify-between items-center z-10 shadow-sm">
        <h2 className="text-2xl font-black text-[#5d4a36] flex items-center gap-3">
          <PieChart className="text-[#78b833]" /> 營運成本模組 (Level 2)
        </h2>
        <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={24} /></button>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: 'overview', icon: PieChart, label: '總覽報表' },
            { id: 'assets', icon: Truck, label: '設備資產' },
            { id: 'stock', icon: Package, label: '耗材進貨' },
            { id: 'labor', icon: HardHat, label: '人力設定' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SubTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-[#78b833] text-white shadow-md' : 'bg-white text-[#b59a7a] hover:bg-[#fffdf5]'}`}
            >
              <tab.icon size={20} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {activeTab === 'overview' && report && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-[#e8dcb9]">
                  <div className="flex items-center gap-4">
                     <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-100 rounded-full"><ChevronLeft/></button>
                     <div className="text-xl font-black text-[#5d4a36] flex items-center gap-2">
                       <Calendar size={20}/> {report.month}
                     </div>
                     <button onClick={() => changeMonth(1)} className="p-2 bg-slate-100 rounded-full"><ChevronRight/></button>
                  </div>
                  <button onClick={downloadReport} className="flex items-center gap-2 text-sm font-bold text-[#78b833] bg-[#f0fdf4] px-3 py-2 rounded-lg border border-[#dcfce7]">
                    <Download size={16}/> 匯出 CSV
                  </button>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border-l-4 border-l-[#78b833] shadow-sm">
                    <div className="text-xs text-slate-400 font-bold mb-1">本月營收</div>
                    <div className="text-2xl font-black text-[#5d4a36]">${report.revenue.toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border-l-4 border-l-red-400 shadow-sm">
                    <div className="text-xs text-slate-400 font-bold mb-1">總成本</div>
                    <div className="text-2xl font-black text-red-500">${Math.round(report.costs.total).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border-l-4 border-l-blue-400 shadow-sm">
                    <div className="text-xs text-slate-400 font-bold mb-1">淨利</div>
                    <div className="text-2xl font-black text-blue-600">${Math.round(report.netProfit).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border-l-4 border-l-orange-400 shadow-sm">
                    <div className="text-xs text-slate-400 font-bold mb-1">淨利率</div>
                    <div className="text-2xl font-black text-orange-500">{report.revenue > 0 ? Math.round((report.netProfit/report.revenue)*100) : 0}%</div>
                  </div>
               </div>

               <div className="bg-white rounded-3xl border-2 border-[#e8dcb9] overflow-hidden">
                  <table className="w-full text-left">
                     <thead className="bg-[#fffbf0] border-b border-[#e8dcb9]">
                        <tr>
                          <th className="p-4 text-sm font-black text-[#b59a7a]">成本項目</th>
                          <th className="p-4 text-sm font-black text-[#b59a7a] text-right">金額</th>
                          <th className="p-4 text-sm font-black text-[#b59a7a] text-right">佔比</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        <tr>
                           <td className="p-4 font-bold text-[#5d4a36] flex items-center gap-2"><HardHat size={16}/> 人力成本 (固定)</td>
                           <td className="p-4 font-mono text-right">${report.costs.labor.toLocaleString()}</td>
                           <td className="p-4 font-mono text-right text-slate-400">{Math.round((report.costs.labor/report.costs.total)*100)}%</td>
                        </tr>
                        <tr>
                           <td className="p-4 font-bold text-[#5d4a36] flex items-center gap-2"><Package size={16}/> 耗材使用 (實際加權)</td>
                           <td className="p-4 font-mono text-right">${Math.round(report.costs.consumables_actual).toLocaleString()}</td>
                           <td className="p-4 font-mono text-right text-slate-400">{Math.round((report.costs.consumables_actual/report.costs.total)*100)}%</td>
                        </tr>
                        <tr>
                           <td className="p-4 font-bold text-[#5d4a36] flex items-center gap-2"><Truck size={16}/> 設備折舊 (攤提)</td>
                           <td className="p-4 font-mono text-right">${Math.round(report.costs.depreciation).toLocaleString()}</td>
                           <td className="p-4 font-mono text-right text-slate-400">{Math.round((report.costs.depreciation/report.costs.total)*100)}%</td>
                        </tr>
                        <tr>
                           <td className="p-4 font-bold text-[#5d4a36] flex items-center gap-2"><Receipt size={16}/> 雜支 (水電/油資等)</td>
                           <td className="p-4 font-mono text-right">${report.costs.overhead.toLocaleString()}</td>
                           <td className="p-4 font-mono text-right text-slate-400">{Math.round((report.costs.overhead/report.costs.total)*100)}%</td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeTab === 'assets' && (
             <div className="space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                   <h3 className="text-xl font-black text-[#5d4a36]">設備資產清冊</h3>
                   <div className="flex gap-2">
                     <button onClick={handleImportDefaults} className="bg-blue-50 text-blue-600 border-blue-100 border-2 px-4 py-2 rounded-xl flex items-center gap-1 font-bold text-sm hover:bg-blue-100">
                        <Import size={16}/> 一鍵匯入預設備品
                     </button>
                     <button onClick={() => setShowAssetForm(!showAssetForm)} className="ac-btn-green px-4 py-2 flex items-center gap-1 text-sm"><Plus size={16}/> 新增資產</button>
                   </div>
                </div>
                
                {showAssetForm && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] space-y-3">
                     <div className="grid grid-cols-2 gap-3">
                        <input className="input-nook py-1" placeholder="類別 (e.g. 電動工具)" value={newAsset.category} onChange={e => setNewAsset({...newAsset, category: e.target.value})} />
                        <input className="input-nook py-1" placeholder="品項名稱" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        <input className="input-nook py-1" type="number" placeholder="成本" value={newAsset.cost || ''} onChange={e => setNewAsset({...newAsset, cost: parseInt(e.target.value)})} />
                        <div className="flex gap-1">
                           <input className="input-nook py-1" type="number" placeholder="數量" value={newAsset.qty || 1} onChange={e => setNewAsset({...newAsset, qty: parseInt(e.target.value)})} />
                           <input className="input-nook py-1 w-16 text-center" placeholder="單位" value={newAsset.unit || '個'} onChange={e => setNewAsset({...newAsset, unit: e.target.value})} />
                        </div>
                        <input className="input-nook py-1" type="number" placeholder="耐用月數 (24)" value={newAsset.lifespanMonths} onChange={e => setNewAsset({...newAsset, lifespanMonths: parseInt(e.target.value)})} />
                     </div>
                     <input className="input-nook py-1" placeholder="備註..." value={newAsset.note} onChange={e => setNewAsset({...newAsset, note: e.target.value})} />
                     <button onClick={handleAddAsset} className="w-full bg-[#78b833] text-white py-2 rounded-xl font-bold">儲存資產</button>
                  </div>
                )}

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                   {assets.length === 0 ? <div className="p-8 text-center text-slate-300">尚未登錄設備</div> : (
                     <table className="w-full text-left">
                        <thead className="bg-slate-50">
                           <tr>
                              <th className="p-3 text-xs font-black text-slate-400">類別 / 名稱</th>
                              <th className="p-3 text-xs font-black text-slate-400">備註</th>
                              <th className="p-3 text-xs font-black text-slate-400 text-right">數量</th>
                              <th className="p-3 text-xs font-black text-slate-400 text-right">成本</th>
                              <th className="p-3 text-xs font-black text-slate-400 text-right">月折舊</th>
                              <th className="p-3"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {assets.map(a => (
                             <tr key={a.id}>
                                <td className="p-3">
                                   <div className="text-[10px] text-slate-400 font-bold">{a.category || '未分類'}</div>
                                   <div className="font-bold text-[#5d4a36] text-sm">{a.name}</div>
                                </td>
                                <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate">{a.note || '-'}</td>
                                <td className="p-3 text-sm font-bold text-right">{a.qty || 1} {a.unit || '個'}</td>
                                <td className="p-3 text-sm font-mono text-right">${a.cost.toLocaleString()}</td>
                                <td className="p-3 text-sm font-mono text-right text-red-400">${Math.round(a.cost / a.lifespanMonths).toLocaleString()}</td>
                                <td className="p-3 text-right">
                                   <button onClick={async () => { if(confirm('刪除?')) { await db.l2.assets.delete(a.id); refreshData(); }}} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   )}
                </div>
             </div>
          )}

          {activeTab === 'stock' && (
             <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-white p-6 rounded-[2rem] border-2 border-[#e8dcb9]">
                      <h3 className="font-black text-[#5d4a36] mb-4">1. 登記進貨</h3>
                      <div className="space-y-3">
                         <div className="flex gap-2">
                            <select className="input-nook py-2" value={newStock.itemType} onChange={e => setNewStock({...newStock, itemType: e.target.value as any})}>
                               <option value="citric">檸檬酸</option>
                               <option value="chemical">藥劑</option>
                            </select>
                            <input type="number" className="input-nook py-2" placeholder="總成本" value={newStock.totalCost || ''} onChange={e => setNewStock({...newStock, totalCost: parseInt(e.target.value)})} />
                         </div>
                         <div className="flex gap-2">
                            <input type="number" className="input-nook py-2" placeholder="數量(桶/包)" value={newStock.quantity} onChange={e => setNewStock({...newStock, quantity: parseInt(e.target.value)})} />
                            <input type="number" className="input-nook py-2" placeholder="每單位可分裝幾罐" value={newStock.yieldPerUnit} onChange={e => setNewStock({...newStock, yieldPerUnit: parseInt(e.target.value)})} />
                         </div>
                         <button onClick={handleAddStock} className="w-full bg-[#78b833] text-white py-3 rounded-xl font-black">儲存進貨單</button>
                      </div>
                   </div>
                   
                   <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-blue-900 mb-4">2. 目前單位成本 (加權平均)</h3>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                            <span className="font-bold text-blue-800">🍋 檸檬酸 / 罐</span>
                            <span className="font-mono text-2xl font-black text-[#5d4a36]">${Math.round(CostEngine.calculateUnitCosts(stockLogs, settings.consumables).citric)}</span>
                         </div>
                         <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                            <span className="font-bold text-blue-800">🧪 藥劑 / 罐</span>
                            <span className="font-mono text-2xl font-black text-[#5d4a36]">${Math.round(CostEngine.calculateUnitCosts(stockLogs, settings.consumables).chemical)}</span>
                         </div>
                         <p className="text-xs text-blue-400 mt-2">
                            * 系統會自動加總所有歷史進貨紀錄，算出平均每罐的真實成本。
                         </p>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[2rem] border-2 border-[#e8dcb9] overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-xs font-black text-slate-400">
                         <tr><th className="p-4">日期</th><th className="p-4">品項</th><th className="p-4 text-right">總成本</th><th className="p-4 text-right">產出罐數</th><th className="p-4"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {stockLogs.map(l => (
                            <tr key={l.id}>
                               <td className="p-4 text-sm font-bold text-slate-500">{l.date}</td>
                               <td className="p-4 font-black text-[#5d4a36]">{l.itemType === 'citric' ? '檸檬酸' : '藥劑'}</td>
                               <td className="p-4 text-right font-mono">${l.totalCost}</td>
                               <td className="p-4 text-right font-mono">{l.quantity * l.yieldPerUnit}</td>
                               <td className="p-4 text-right"><button onClick={async () => { await db.l2.stock.delete(l.id); refreshData(); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
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
                         <input type="number" className="input-nook py-3 text-lg" value={settings.laborBreakdown?.bossSalary ?? 30000} onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const partner = settings.laborBreakdown?.partnerSalary ?? 30000;
                            const newSet = {
                                ...settings,
                                monthlySalary: val + partner,
                                laborBreakdown: { ...settings.laborBreakdown!, bossSalary: val }
                            };
                            setSettings(newSet);
                            db.settings.save(newSet);
                         }} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-1 block">闆娘月薪</label>
                         <input type="number" className="input-nook py-3 text-lg" value={settings.laborBreakdown?.partnerSalary ?? 30000} onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const boss = settings.laborBreakdown?.bossSalary ?? 30000;
                            const newSet = {
                                ...settings,
                                monthlySalary: boss + val,
                                laborBreakdown: { ...settings.laborBreakdown!, partnerSalary: val }
                            };
                            setSettings(newSet);
                            db.settings.save(newSet);
                         }} />
                      </div>
                   </div>

                   <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                         <span className="font-black text-slate-400">每月總固定支出</span>
                         <span className="text-3xl font-black text-[#5d4a36]">${settings.monthlySalary.toLocaleString()}</span>
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

export default CostAnalysisModule;

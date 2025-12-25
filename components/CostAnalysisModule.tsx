
import React from 'react';
import { db } from '../services/db';
import { Asset, ConsumableLog } from '../types';
import { CostEngine, MonthlyCostReport } from '../services/costEngine';
import { X, PieChart, Package, Truck, HardHat, Receipt, Trash2, Plus, Calendar, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface CostAnalysisModuleProps {
  onClose: () => void;
}

type SubTab = 'overview' | 'assets' | 'stock' | 'labor';

const CostAnalysisModule: React.FC<CostAnalysisModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = React.useState<SubTab>('overview');
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Data
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [stockLogs, setStockLogs] = React.useState<ConsumableLog[]>([]);
  const [report, setReport] = React.useState<MonthlyCostReport | null>(null);
  const [settings, setSettings] = React.useState(db.settings.get());

  // Forms
  const [showAssetForm, setShowAssetForm] = React.useState(false);
  const [newAsset, setNewAsset] = React.useState<Partial<Asset>>({ name: '', cost: 0, lifespanMonths: 24, purchaseDate: new Date().toLocaleDateString('en-CA'), status: 'active' });

  const [showStockForm, setShowStockForm] = React.useState(false);
  const [newStock, setNewStock] = React.useState<Partial<ConsumableLog>>({ type: 'citric', purchaseType: 'bulk', quantity: 1, totalCost: 0, yieldEstimate: 20 });

  const refreshData = () => {
    setAssets(db.assets.getAll());
    setStockLogs(db.stock.getAll());
    setSettings(db.settings.get());
  };

  React.useEffect(() => {
    refreshData();
  }, []);

  React.useEffect(() => {
    // Generate Report on data/date change
    const r = CostEngine.generateMonthlyReport(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      db.jobs.getAll(),
      db.expenses.getAll(),
      assets,
      stockLogs,
      settings
    );
    setReport(r);
  }, [currentDate, assets, stockLogs, settings]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  // --- Handlers ---
  const handleAddAsset = () => {
    if (!newAsset.name || !newAsset.cost) return;
    db.assets.save({ ...newAsset, id: db.assets.generateId() } as Asset);
    setShowAssetForm(false);
    refreshData();
  };

  const handleAddStock = () => {
    if (!newStock.quantity || !newStock.totalCost) return;
    db.stock.save({ ...newStock, id: db.stock.generateId(), date: new Date().toLocaleDateString('en-CA') } as ConsumableLog);
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
    <div className="fixed inset-0 z-[60] bg-[#fbf8e6] overflow-auto animate-in slide-in-from-bottom-10">
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
                   <button onClick={() => setShowAssetForm(!showAssetForm)} className="ac-btn-green px-4 py-2 flex items-center gap-1 text-sm"><Plus size={16}/> 新增資產</button>
                </div>
                
                {showAssetForm && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] space-y-3">
                     <div className="grid grid-cols-2 gap-3">
                        <input className="input-nook py-1" placeholder="設備名稱 (e.g. 高壓清洗機)" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} />
                        <input className="input-nook py-1" type="date" value={newAsset.purchaseDate} onChange={e => setNewAsset({...newAsset, purchaseDate: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <input className="input-nook py-1" type="number" placeholder="購入金額" value={newAsset.cost || ''} onChange={e => setNewAsset({...newAsset, cost: parseInt(e.target.value)})} />
                        <input className="input-nook py-1" type="number" placeholder="耐用月數 (預設24)" value={newAsset.lifespanMonths} onChange={e => setNewAsset({...newAsset, lifespanMonths: parseInt(e.target.value)})} />
                     </div>
                     <button onClick={handleAddAsset} className="w-full bg-[#78b833] text-white py-2 rounded-xl font-bold">儲存資產</button>
                  </div>
                )}

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                   {assets.length === 0 ? <div className="p-8 text-center text-slate-300">尚未登錄設備</div> : (
                     <table className="w-full text-left">
                        <thead className="bg-slate-50">
                           <tr>
                              <th className="p-3 text-xs font-black text-slate-400">名稱</th>
                              <th className="p-3 text-xs font-black text-slate-400">購入日</th>
                              <th className="p-3 text-xs font-black text-slate-400 text-right">成本</th>
                              <th className="p-3 text-xs font-black text-slate-400 text-right">月折舊</th>
                              <th className="p-3"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {assets.map(a => (
                             <tr key={a.id}>
                                <td className="p-3 font-bold text-[#5d4a36]">{a.name}</td>
                                <td className="p-3 text-sm text-slate-500">{a.purchaseDate}</td>
                                <td className="p-3 text-sm font-mono text-right">${a.cost.toLocaleString()}</td>
                                <td className="p-3 text-sm font-mono text-right text-red-400">${Math.round(a.cost / a.lifespanMonths).toLocaleString()}</td>
                                <td className="p-3 text-right">
                                   <button onClick={() => { if(confirm('刪除?')) { db.assets.delete(a.id); refreshData(); }}} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
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
             <div className="space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                   <h3 className="text-xl font-black text-[#5d4a36]">耗材進貨紀錄</h3>
                   <button onClick={() => setShowStockForm(!showStockForm)} className="ac-btn-green px-4 py-2 flex items-center gap-1 text-sm"><Plus size={16}/> 登記進貨</button>
                </div>

                {showStockForm && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] space-y-3">
                     <div className="flex gap-2">
                        <select className="input-nook py-1" value={newStock.type} onChange={e => setNewStock({...newStock, type: e.target.value as any})}>
                           <option value="citric">檸檬酸</option>
                           <option value="chemical">藥劑</option>
                        </select>
                        <select className="input-nook py-1" value={newStock.purchaseType} onChange={e => setNewStock({...newStock, purchaseType: e.target.value as any})}>
                           <option value="bulk">批發(桶/袋)</option>
                           <option value="retail">零售</option>
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-[10px] text-slate-400 font-bold">進貨數量 (桶/包)</label>
                           <input className="input-nook py-1" type="number" value={newStock.quantity} onChange={e => setNewStock({...newStock, quantity: parseInt(e.target.value)})} />
                        </div>
                        <div>
                           <label className="text-[10px] text-slate-400 font-bold">總進貨金額</label>
                           <input className="input-nook py-1" type="number" value={newStock.totalCost || ''} onChange={e => setNewStock({...newStock, totalCost: parseInt(e.target.value)})} />
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] text-slate-400 font-bold">預估可分裝成幾罐 (總計)?</label>
                        <input className="input-nook py-1" type="number" value={newStock.yieldEstimate} onChange={e => setNewStock({...newStock, yieldEstimate: parseInt(e.target.value)})} />
                        <p className="text-[10px] text-orange-400 mt-1">
                           * 平均每罐成本: ${newStock.totalCost && newStock.yieldEstimate ? Math.round(newStock.totalCost / newStock.yieldEstimate) : 0}
                        </p>
                     </div>
                     <button onClick={handleAddStock} className="w-full bg-[#78b833] text-white py-2 rounded-xl font-bold">儲存紀錄</button>
                  </div>
                )}
                
                <div className="bg-blue-50 p-4 rounded-2xl text-xs text-blue-700 font-bold">
                   系統會根據您的進貨紀錄，採用「加權平均法」計算每個月的實際耗材成本，比單純設定固定成本更精準。
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50">
                         <tr>
                            <th className="p-3 text-xs font-black text-slate-400">日期</th>
                            <th className="p-3 text-xs font-black text-slate-400">品項</th>
                            <th className="p-3 text-xs font-black text-slate-400 text-right">進貨數</th>
                            <th className="p-3 text-xs font-black text-slate-400 text-right">總金額</th>
                            <th className="p-3 text-xs font-black text-slate-400 text-right">預估罐數</th>
                            <th className="p-3"></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {stockLogs.map(l => (
                            <tr key={l.id}>
                               <td className="p-3 text-sm text-slate-500">{l.date}</td>
                               <td className="p-3 font-bold text-[#5d4a36]">{l.type === 'citric' ? '🍋 檸檬酸' : '🧪 藥劑'}</td>
                               <td className="p-3 text-sm font-mono text-right">{l.quantity} {l.purchaseType === 'bulk' ? '桶/包' : '個'}</td>
                               <td className="p-3 text-sm font-mono text-right text-[#78b833]">${l.totalCost.toLocaleString()}</td>
                               <td className="p-3 text-sm font-mono text-right">{l.yieldEstimate} 罐</td>
                               <td className="p-3 text-right">
                                  <button onClick={() => { if(confirm('刪除?')) { db.stock.delete(l.id); refreshData(); }}} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {activeTab === 'labor' && (
             <div className="space-y-4 animate-in fade-in">
                <h3 className="text-xl font-black text-[#5d4a36]">固定人力成本設定</h3>
                
                <div className="bg-white p-6 rounded-3xl border-2 border-[#e8dcb9] space-y-6">
                   <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl">👨</div>
                      <div className="flex-1">
                         <label className="text-xs font-bold text-[#b59a7a]">老闆月薪</label>
                         <input 
                           type="number" 
                           className="input-nook" 
                           value={settings.laborBreakdown?.bossSalary ?? 30000}
                           onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              const partner = settings.laborBreakdown?.partnerSalary ?? 30000;
                              const newSet = {
                                ...settings,
                                monthlySalary: val + partner,
                                laborBreakdown: { bossSalary: val, partnerSalary: partner }
                              };
                              setSettings(newSet);
                              db.settings.save(newSet);
                           }}
                         />
                      </div>
                   </div>

                   <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-3xl">👩</div>
                      <div className="flex-1">
                         <label className="text-xs font-bold text-[#b59a7a]">闆娘月薪</label>
                         <input 
                           type="number" 
                           className="input-nook" 
                           value={settings.laborBreakdown?.partnerSalary ?? 30000}
                           onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              const boss = settings.laborBreakdown?.bossSalary ?? 30000;
                              const newSet = {
                                ...settings,
                                monthlySalary: boss + val,
                                laborBreakdown: { bossSalary: boss, partnerSalary: val }
                              };
                              setSettings(newSet);
                              db.settings.save(newSet);
                           }}
                         />
                      </div>
                   </div>
                   
                   <div className="pt-4 border-t border-slate-100 text-right">
                      <div className="text-xs font-bold text-slate-400">總月薪成本 (自動同步至簡易報表)</div>
                      <div className="text-3xl font-black text-[#5d4a36]">${settings.monthlySalary.toLocaleString()}</div>
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

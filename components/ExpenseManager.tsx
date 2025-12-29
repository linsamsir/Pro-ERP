
import React from 'react';
import { db } from '../services/db';
import { Expense } from '../types';
import { auth } from '../services/auth';
import { X, Search, Trash2, Calendar, DollarSign, ArrowLeft, ArrowRight, Tag, Wallet, Plus, AlertCircle, Save } from 'lucide-react';

// Removed onClose prop as this is now a full page
const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [filtered, setFiltered] = React.useState<Expense[]>([]);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<Expense>>({});
  
  // New Expense Form State
  const [isAdding, setIsAdding] = React.useState(false);
  const [newExp, setNewExp] = React.useState<Partial<Expense>>({ 
    date: new Date().toLocaleDateString('en-CA'), 
    category: 'other', 
    amount: 0, 
    note: '',
    cashflowOnly: false
  });

  const canWrite = auth.canWrite();

  const loadData = async () => {
    setLoading(true);
    const datePrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const all = await db.expenses.getAll();
    const monthData = all.filter(e => e.date.startsWith(datePrefix));
    setExpenses(monthData);
    setLoading(false);
  };

  React.useEffect(() => {
    loadData();
  }, [currentDate]);

  React.useEffect(() => {
    if (!searchTerm) {
      setFiltered(expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      const lower = searchTerm.toLowerCase();
      setFiltered(expenses.filter(e => e.note?.toLowerCase().includes(lower) || e.amount.toString().includes(lower)));
    }
  }, [searchTerm, expenses]);

  const changeMonth = (delta: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此筆支出？")) return;
    await db.expenses.delete(id);
    loadData();
  };

  const handleSaveNew = async () => {
    if (!newExp.amount || !newExp.date) return alert("請輸入日期與金額");
    await db.expenses.save({
      id: db.expenses.generateId(),
      date: newExp.date!,
      category: newExp.category as any,
      amount: newExp.amount!,
      note: newExp.note,
      cashflowOnly: newExp.cashflowOnly,
      source: 'manual_form',
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setNewExp({ date: new Date().toLocaleDateString('en-CA'), category: 'other', amount: 0, note: '', cashflowOnly: false });
    loadData();
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setEditForm({ ...e });
  };

  const saveEdit = async () => {
    if (!editForm.id) return;
    await db.expenses.save(editForm as Expense);
    setEditingId(null);
    loadData();
  };

  const categories = [
    { id: 'insurance', label: '勞健保', color: 'bg-blue-100 text-blue-700' },
    { id: 'utilities', label: '水電', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'phone', label: '電話網路', color: 'bg-indigo-100 text-indigo-700' },
    { id: 'fuel', label: '油資', color: 'bg-red-100 text-red-700' },
    { id: 'consumables', label: '耗材', color: 'bg-green-100 text-green-700' },
    { id: 'equipment', label: '設備', color: 'bg-slate-200 text-slate-700' },
    { id: 'other', label: '雜支', color: 'bg-slate-100 text-slate-600' },
  ];

  const getCatLabel = (c: string) => categories.find(cat => cat.id === c)?.label || c;
  const getCatColor = (c: string) => categories.find(cat => cat.id === c)?.color || 'bg-slate-100';

  const totalAmount = filtered.filter(e => !e.cashflowOnly).reduce((s, e) => s + e.amount, 0);
  const totalCashflow = filtered.filter(e => e.cashflowOnly).reduce((s, e) => s + e.amount, 0);

  return (
    // FIX: Layout to be a normal page flow, not fixed overlay
    <div className="min-h-full animate-pop p-4 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-[#e8dcb9] pb-6">
        <div>
          <h1 className="text-h1 flex items-center gap-3">
            <Wallet className="text-[#78b833]" size={36} /> 支出管理簿
          </h1>
          <p className="text-note font-bold mt-2 ml-1">
            記錄村莊營運的每一筆開銷
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
           <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-[#e8dcb9] shadow-sm self-start">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ArrowLeft size={20}/></button>
              <span className="text-lg font-black text-[#5d4a36] px-4 min-w-[140px] text-center">
                 {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ArrowRight size={20}/></button>
           </div>

           <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  className="input-nook pl-10 py-2 text-sm" 
                  placeholder="搜尋支出備註..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {canWrite && (
                <button onClick={() => setIsAdding(!isAdding)} className="bg-[#78b833] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm whitespace-nowrap">
                  <Plus size={20}/> 新增
                </button>
              )}
           </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-white p-6 rounded-2xl border-l-8 border-l-red-400 shadow-sm">
              <div className="text-xs font-bold text-slate-400 mb-1">本月損益支出</div>
              <div className="text-4xl font-black text-red-500">${totalAmount.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-2 font-bold flex items-center gap-1"><AlertCircle size={12}/> 計入淨利計算</div>
           </div>
           <div className="bg-white p-6 rounded-2xl border-l-8 border-l-slate-400 shadow-sm">
              <div className="text-xs font-bold text-slate-400 mb-1">純現金流支出 (薪資/提領)</div>
              <div className="text-4xl font-black text-slate-600">${totalCashflow.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-2 font-bold">不影響損益，僅供記帳</div>
           </div>
        </div>

        {/* Add Form (Inline Modal inside page) */}
        {isAdding && (
          <div className="bg-white p-6 rounded-2xl border-2 border-[#78b833] shadow-lg animate-in fade-in slide-in-from-top-4">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-black text-[#5d4a36]">新增一筆支出</h3>
               <button onClick={() => setIsAdding(false)} className="text-slate-300"><X/></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input type="date" className="input-nook py-2" value={newExp.date} onChange={e => setNewExp({...newExp, date: e.target.value})} />
                <select className="input-nook py-2" value={newExp.category} onChange={e => setNewExp({...newExp, category: e.target.value as any})}>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <div className="relative col-span-2">
                   <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                   <input type="number" className="input-nook pl-8 py-2" placeholder="金額" value={newExp.amount || ''} onChange={e => setNewExp({...newExp, amount: parseInt(e.target.value)})} />
                </div>
             </div>
             <div className="mb-4">
               <input className="input-nook py-2" placeholder="備註說明" value={newExp.note} onChange={e => setNewExp({...newExp, note: e.target.value})} />
             </div>
             <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" className="w-5 h-5 accent-slate-500" checked={newExp.cashflowOnly} onChange={e => setNewExp({...newExp, cashflowOnly: e.target.checked})} />
                   <span className="text-sm font-bold text-slate-500">純現金流 (不計入損益)</span>
                </label>
                <button onClick={handleSaveNew} className="bg-[#78b833] text-white px-6 py-2 rounded-xl font-black shadow-sm">儲存</button>
             </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-3xl border-2 border-[#e8dcb9] overflow-hidden shadow-sm min-h-[400px]">
           {loading ? (
             <div className="p-10 text-center text-slate-400">載入中...</div>
           ) : filtered.length === 0 ? (
             <div className="p-10 text-center text-slate-300">本月尚無支出紀錄</div>
           ) : (
             <table className="w-full text-left">
                <thead className="bg-[#fffbf0] border-b border-[#e8dcb9]">
                   <tr>
                      <th className="p-4 text-xs font-black text-[#b59a7a]">日期</th>
                      <th className="p-4 text-xs font-black text-[#b59a7a]">類別</th>
                      <th className="p-4 text-xs font-black text-[#b59a7a]">備註</th>
                      <th className="p-4 text-xs font-black text-[#b59a7a] text-right">金額</th>
                      <th className="p-4 w-10"></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {filtered.map(e => (
                     <tr key={e.id} className={`hover:bg-[#fbf8e6] transition-colors ${e.cashflowOnly ? 'bg-slate-50' : ''}`}>
                        {editingId === e.id ? (
                          <>
                            <td className="p-2"><input type="date" className="input-nook py-1 text-xs" value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                            <td className="p-2">
                              <select className="input-nook py-1 text-xs" value={editForm.category} onChange={ev => setEditForm({...editForm, category: ev.target.value as any})}>
                                 {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                              </select>
                            </td>
                            <td className="p-2"><input className="input-nook py-1 text-xs" value={editForm.note} onChange={ev => setEditForm({...editForm, note: ev.target.value})} /></td>
                            <td className="p-2 text-right"><input type="number" className="input-nook py-1 text-xs text-right w-24 ml-auto" value={editForm.amount} onChange={ev => setEditForm({...editForm, amount: parseInt(ev.target.value)})} /></td>
                            <td className="p-2 flex gap-1 justify-end">
                               <button onClick={saveEdit} className="p-1 bg-green-100 text-green-600 rounded"><Save size={16}/></button>
                               <button onClick={() => setEditingId(null)} className="p-1 bg-slate-100 text-slate-400 rounded"><X size={16}/></button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4 text-sm font-bold text-slate-500 whitespace-nowrap">{e.date}</td>
                            <td className="p-4">
                               <span className={`text-xs px-2 py-1 rounded font-bold ${getCatColor(e.category)}`}>
                                  {getCatLabel(e.category)}
                               </span>
                               {e.cashflowOnly && <span className="ml-1 text-[10px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded">現金流</span>}
                            </td>
                            <td className="p-4 font-bold text-[#5d4a36]">{e.note || '-'}</td>
                            <td className={`p-4 text-right font-mono font-bold text-lg ${e.cashflowOnly ? 'text-slate-400 decoration-slate-300' : 'text-red-500'}`}>
                               ${e.amount.toLocaleString()}
                            </td>
                            <td className="p-4 text-right whitespace-nowrap">
                               {canWrite && (
                                 <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(e)} className="text-slate-300 hover:text-blue-500"><Tag size={16}/></button>
                                    <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                 </div>
                               )}
                            </td>
                          </>
                        )}
                     </tr>
                   ))}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseManager;


import React from 'react';
import { db } from '../services/db';
import { L2Asset } from '../types';
import { MessageCircle, Sparkles, X, Check, AlertTriangle, PenTool, DollarSign, Trash2 } from 'lucide-react';

interface ChatAssetModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const ChatAssetModal: React.FC<ChatAssetModalProps> = ({ onClose, onSaved }) => {
  const [input, setInput] = React.useState('');
  const [parsedItems, setParsedItems] = React.useState<Partial<L2Asset>[]>([]);
  const [step, setStep] = React.useState<'INPUT' | 'PREVIEW'>('INPUT');

  const handleParse = () => {
    if (!input.trim()) return;
    
    // Split by common delimiters: comma, chinese comma,顿号, newline
    const segments = input.split(/[,，、\n]+/).filter(s => s.trim());
    const items: Partial<L2Asset>[] = [];

    segments.forEach(seg => {
        // Regex: Try to find name and ending number
        // "High Pressure 15000" -> Name: "High Pressure", Cost: 15000
        // "Extension Cord 300" -> Name: "Extension Cord", Cost: 300
        const match = seg.trim().match(/^(.*?)\s+(\d+)$/);
        
        if (match) {
            items.push({
                name: match[1].trim(),
                cost: parseInt(match[2]),
                qty: 1,
                category: '其他',
                purchaseDate: new Date().toLocaleDateString('en-CA'),
                status: 'active',
                lifespanMonths: 24,
                unit: '個'
            });
        } else {
            // No number found, assume it's just name with 0 cost
            items.push({
                name: seg.trim(),
                cost: 0,
                qty: 1,
                category: '其他',
                purchaseDate: new Date().toLocaleDateString('en-CA'),
                status: 'active',
                lifespanMonths: 24,
                unit: '個'
            });
        }
    });

    setParsedItems(items);
    setStep('PREVIEW');
  };

  const handleSave = async () => {
    if (parsedItems.length === 0) return;

    for (const item of parsedItems) {
        await db.l2.assets.save({
            ...item,
            id: db.l2.assets.generateId()
        } as L2Asset);
    }

    onSaved();
    onClose();
  };

  const removeItem = (idx: number) => {
    const newItems = parsedItems.filter((_, i) => i !== idx);
    setParsedItems(newItems);
    if (newItems.length === 0) setStep('INPUT');
  };

  const updateItem = (idx: number, field: keyof L2Asset, val: any) => {
      const newItems = [...parsedItems];
      newItems[idx] = { ...newItems[idx], [field]: val };
      setParsedItems(newItems);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-[#fffbf0] w-full sm:max-w-md h-[90vh] sm:h-auto sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col border-t-4 sm:border-4 border-[#e8dcb9]">
        
        {/* Header */}
        <div className="p-5 border-b-2 border-[#e8dcb9] flex justify-between items-center bg-white sm:rounded-t-[1.8rem] rounded-t-[1.8rem]">
          <h3 className="text-xl font-black text-[#5d4a36] flex items-center gap-2">
            <MessageCircle className="text-[#78b833]" /> 對話新增設備
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === 'INPUT' ? (
            <div className="space-y-4">
               <p className="text-sm font-bold text-[#b59a7a]">請輸入設備名稱與價格，用逗號或換行分隔。</p>
               <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] shadow-inner">
                  <textarea
                    className="w-full h-40 bg-transparent outline-none text-lg font-bold text-[#5d4a36] placeholder:text-slate-300 resize-none"
                    placeholder="例：高壓清洗機 15000、延長線 300&#10;吸塵器 4500"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    autoFocus
                  />
               </div>
               <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#名稱+空格+金額</span>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#可多筆同時</span>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="text-sm font-bold text-[#b59a7a] flex items-center gap-2">
                 <Sparkles size={16}/> 識別出 {parsedItems.length} 項設備：
               </div>
               
               {parsedItems.map((item, idx) => (
                 <div key={idx} className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] relative group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 100}ms` }}>
                    <button 
                      onClick={() => removeItem(idx)}
                      className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-400 z-10"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="grid grid-cols-3 gap-3 pr-6">
                       <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 mb-1 block">名稱</label>
                          <input 
                            className="input-nook py-1 px-2 text-sm" 
                            value={item.name} 
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-slate-400 mb-1 block">成本</label>
                          <input 
                            type="number"
                            className="input-nook py-1 px-2 text-sm text-right" 
                            value={item.cost} 
                            onChange={e => updateItem(idx, 'cost', parseInt(e.target.value))}
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-slate-400 mb-1 block">數量</label>
                          <input 
                            type="number"
                            className="input-nook py-1 px-2 text-sm text-center" 
                            value={item.qty} 
                            onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))}
                          />
                       </div>
                    </div>
                 </div>
               ))}

               <button 
                 onClick={() => setStep('INPUT')} 
                 className="text-xs font-bold text-slate-400 underline w-full text-center py-2"
               >
                 重新輸入
               </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#e8dcb9] bg-white sm:rounded-b-[1.8rem]">
          {step === 'INPUT' ? (
            <button 
              onClick={handleParse}
              disabled={!input.trim()}
              className="w-full bg-[#5d4a36] text-white py-4 rounded-2xl font-black text-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              <Sparkles size={20} className="text-yellow-400"/> 解析內容
            </button>
          ) : (
             <div className="flex gap-3">
               <button 
                 onClick={() => setStep('INPUT')}
                 className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold active:scale-[0.98]"
               >
                 修改
               </button>
               <button 
                 onClick={handleSave}
                 className="flex-[2] bg-[#78b833] text-white py-4 rounded-2xl font-black text-xl shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
               >
                 <Check size={24}/> 確認新增
               </button>
             </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ChatAssetModal;

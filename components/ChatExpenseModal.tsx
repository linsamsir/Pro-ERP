
import React from 'react';
import { ParsedExpensePreview, parseExpenseInput } from '../services/expenseParser';
import { db } from '../services/db';
import { MessageCircle, Sparkles, X, Check, ArrowRight, AlertTriangle, Calendar } from 'lucide-react';
import { Expense } from '../types';

interface ChatExpenseModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const ChatExpenseModal: React.FC<ChatExpenseModalProps> = ({ onClose, onSaved }) => {
  const [input, setInput] = React.useState('');
  const [parsedItems, setParsedItems] = React.useState<ParsedExpensePreview[]>([]);
  const [step, setStep] = React.useState<'INPUT' | 'PREVIEW'>('INPUT');

  const handleParse = () => {
    if (!input.trim()) return;
    const items = parseExpenseInput(input);
    setParsedItems(items);
    setStep('PREVIEW');
  };

  const handleSave = () => {
    // Filter out items with 0 amount to be safe
    const validItems = parsedItems.filter(i => i.amount > 0);
    
    if (validItems.length === 0) {
      alert("沒有有效的支出金額可儲存");
      return;
    }

    validItems.forEach(item => {
      const newExpense: Expense = {
        id: db.expenses.generateId(),
        date: item.date,
        category: item.category,
        amount: item.amount,
        note: `[對話] ${item.note}`,
        raw_input: input,
        source: 'chat_input',
        createdAt: new Date().toISOString()
      };
      db.expenses.save(newExpense);
    });

    onSaved();
    onClose();
  };

  const removeItem = (idx: number) => {
    const newItems = parsedItems.filter((_, i) => i !== idx);
    setParsedItems(newItems);
    if (newItems.length === 0) setStep('INPUT');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-[#fffbf0] w-full sm:max-w-md h-[90vh] sm:h-auto sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col border-t-4 sm:border-4 border-[#e8dcb9]">
        
        {/* Header */}
        <div className="p-5 border-b-2 border-[#e8dcb9] flex justify-between items-center bg-white sm:rounded-t-[1.8rem] rounded-t-[1.8rem]">
          <h3 className="text-xl font-black text-[#5d4a36] flex items-center gap-2">
            <MessageCircle className="text-[#78b833]" /> 對話快速記帳
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === 'INPUT' ? (
            <div className="space-y-4">
               <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] shadow-inner">
                  <textarea
                    className="w-full h-40 bg-transparent outline-none text-lg font-bold text-[#5d4a36] placeholder:text-slate-300 resize-none"
                    placeholder="例：這個月15號 勞保+健保 6613+6848&#10;或是：昨天 加油 500"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    autoFocus
                  />
               </div>
               <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#勞健保</span>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#水電</span>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#油資</span>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-400">#金額加總</span>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="text-sm font-bold text-[#b59a7a] flex items-center gap-2">
                 <Sparkles size={16}/> 幫您分析出 {parsedItems.length} 筆資料：
               </div>
               
               {parsedItems.map((item, idx) => (
                 <div key={idx} className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] relative group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 100}ms` }}>
                    <button 
                      onClick={() => removeItem(idx)}
                      className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>

                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${item.category === 'other' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                {item.categoryLabel}
                             </span>
                             <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                               <Calendar size={12}/> {item.date}
                             </span>
                          </div>
                          <div className="text-2xl font-black text-[#5d4a36]">
                             ${item.amount.toLocaleString()}
                          </div>
                       </div>
                    </div>
                    
                    <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded-lg break-all">
                       原始：{item.note}
                    </div>

                    {(item.warning || item.confidence === 'LOW') && (
                      <div className="mt-2 text-xs font-bold text-orange-500 flex items-center gap-1">
                        <AlertTriangle size={12} /> {item.warning || '信心度低，請確認'}
                      </div>
                    )}
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
                 <Check size={24}/> 確認寫入
               </button>
             </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ChatExpenseModal;

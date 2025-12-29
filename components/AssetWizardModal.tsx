
import React from 'react';
import { L2Asset } from '../types';
import { db } from '../services/db';
import { X, ArrowRight, ArrowLeft, Check, Package, DollarSign, PenTool, Hash, FileText } from 'lucide-react';

interface AssetWizardModalProps {
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'NAME' | 'CATEGORY' | 'COST_QTY' | 'NOTE' | 'CONFIRM';

const AssetWizardModal: React.FC<AssetWizardModalProps> = ({ onClose, onSaved }) => {
  const [step, setStep] = React.useState<Step>('NAME');
  const [data, setData] = React.useState<Partial<L2Asset>>({
    qty: 1,
    unit: '台',
    cost: 0,
    lifespanMonths: 24,
    status: 'active',
    purchaseDate: new Date().toLocaleDateString('en-CA')
  });

  const update = (u: Partial<L2Asset>) => setData(prev => ({ ...prev, ...u }));

  const categories = ['電動核心工具', '手動輔助工具', '安全防護裝備', '清潔劑與耗材', '其他'];

  const handleNext = () => {
    if (step === 'NAME' && !data.name) return alert("請輸入設備名稱");
    if (step === 'NAME') setStep('CATEGORY');
    else if (step === 'CATEGORY') setStep('COST_QTY');
    else if (step === 'COST_QTY') setStep('NOTE');
    else if (step === 'NOTE') setStep('CONFIRM');
  };

  const handleBack = () => {
    if (step === 'CATEGORY') setStep('NAME');
    else if (step === 'COST_QTY') setStep('CATEGORY');
    else if (step === 'NOTE') setStep('COST_QTY');
    else if (step === 'CONFIRM') setStep('NOTE');
  };

  const handleSave = async () => {
    const finalAsset = {
        ...data,
        id: db.l2.assets.generateId(),
        category: data.category || '其他',
        cost: data.cost || 0,
        qty: data.qty || 1
    } as L2Asset;

    await db.l2.assets.save(finalAsset);
    onSaved(); // Trigger refresh
    onClose();
  };

  // Render Helpers
  const Title = ({ icon: Icon, text }: any) => (
    <h3 className="text-xl font-black text-[#5d4a36] flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-full bg-[#e8dcb9] flex items-center justify-center text-[#78b833]"><Icon size={20}/></div>
      {text}
    </h3>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#fffbf0] w-full max-w-md rounded-[2rem] shadow-2xl border-4 border-[#e8dcb9] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b-2 border-[#e8dcb9] flex justify-between items-center bg-white">
          <span className="font-black text-[#b59a7a] text-sm">新增設備精靈</span>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto">
            
            {step === 'NAME' && (
                <div className="animate-in slide-in-from-right-4 fade-in">
                    <Title icon={PenTool} text="這個設備叫什麼名字？" />
                    <input 
                        autoFocus
                        className="input-nook py-4 text-xl text-center" 
                        placeholder="例如：高壓清洗機 K5"
                        value={data.name || ''}
                        onChange={e => update({ name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleNext()}
                    />
                </div>
            )}

            {step === 'CATEGORY' && (
                <div className="animate-in slide-in-from-right-4 fade-in">
                    <Title icon={Package} text="它屬於哪一類？" />
                    <div className="grid grid-cols-1 gap-3">
                        {categories.map(c => (
                            <button 
                                key={c}
                                onClick={() => { update({ category: c }); setTimeout(handleNext, 100); }}
                                className={`p-4 rounded-xl font-bold border-2 text-left transition-all ${data.category === c ? 'bg-[#78b833] text-white border-[#78b833]' : 'bg-white border-slate-100 text-[#5d4a36] hover:border-[#e8dcb9]'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 'COST_QTY' && (
                <div className="animate-in slide-in-from-right-4 fade-in space-y-6">
                    <div>
                        <Title icon={DollarSign} text="購入成本與數量" />
                        <label className="text-xs font-bold text-slate-400 block mb-2">單價/總價 ($)</label>
                        <input 
                            type="number"
                            autoFocus
                            className="input-nook py-3 text-lg" 
                            placeholder="0"
                            value={data.cost || ''}
                            onChange={e => update({ cost: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 block mb-2">數量</label>
                            <input 
                                type="number"
                                className="input-nook py-3 text-center" 
                                value={data.qty}
                                onChange={e => update({ qty: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 block mb-2">單位</label>
                            <input 
                                className="input-nook py-3 text-center" 
                                value={data.unit}
                                onChange={e => update({ unit: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {step === 'NOTE' && (
                <div className="animate-in slide-in-from-right-4 fade-in">
                    <Title icon={FileText} text="有什麼備註嗎？" />
                    <textarea 
                        autoFocus
                        className="input-nook py-3 h-32 resize-none" 
                        placeholder="例如：二手購入、保固到 2025..."
                        value={data.note || ''}
                        onChange={e => update({ note: e.target.value })}
                    />
                </div>
            )}

            {step === 'CONFIRM' && (
                <div className="animate-in slide-in-from-right-4 fade-in text-center">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                        ✨
                    </div>
                    <h3 className="text-2xl font-black text-[#5d4a36] mb-2">{data.name}</h3>
                    <p className="text-[#b59a7a] font-bold mb-6">即將新增至資產清冊</p>
                    
                    <div className="bg-white p-4 rounded-xl text-left text-sm space-y-2 border border-slate-100 mb-6">
                        <div className="flex justify-between"><span>類別:</span> <span className="font-bold">{data.category}</span></div>
                        <div className="flex justify-between"><span>成本:</span> <span className="font-bold">${data.cost}</span></div>
                        <div className="flex justify-between"><span>數量:</span> <span className="font-bold">{data.qty} {data.unit}</span></div>
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#e8dcb9] bg-white flex gap-3">
            {step !== 'NAME' && (
                <button onClick={handleBack} className="px-6 py-3 rounded-xl bg-slate-100 font-bold text-slate-500 hover:bg-slate-200">
                    <ArrowLeft size={20}/>
                </button>
            )}
            
            {step === 'CONFIRM' ? (
                <button onClick={handleSave} className="flex-1 btn-primary py-3">
                    確認新增 <Check size={20}/>
                </button>
            ) : (
                <button onClick={handleNext} className="flex-1 btn-primary py-3 justify-between px-6">
                    下一步 <ArrowRight size={20}/>
                </button>
            )}
        </div>

      </div>
    </div>
  );
};

export default AssetWizardModal;

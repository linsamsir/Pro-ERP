
import React from 'react';
import { db } from '../services/db';
import { Job, JobStatus, ServiceItem, TankConfig, Customer, ExtraItem } from '../types';
import { Save, ArrowLeft, Calendar, Receipt, Wrench, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle2, Clock, Minus, AlertCircle, Home, MapPin, Car, Edit2, X, Tag } from 'lucide-react';

interface JobManagementProps {
  initialJob?: Job;
  initialCustomer?: Customer; 
  onCancel: () => void;
  onSave: (job: Job) => void;
}

const JobManagement: React.FC<JobManagementProps> = ({ initialJob, initialCustomer, onCancel, onSave }) => {
  // --- Init State (Mapping Legacy to New Schema) ---
  const [job, setJob] = React.useState<Job>(() => {
    // Clone to avoid mutating props if initialJob is passed
    const base: any = initialJob ? JSON.parse(JSON.stringify(initialJob)) : {
      jobId: db.jobs.generateId(),
      customerId: initialCustomer?.customer_id || '',
      status: JobStatus.COMPLETED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactPerson: initialCustomer?.contactName || '',
      contactPhone: initialCustomer?.phones[0]?.number || '',
      serviceItems: [ServiceItem.TANK],
      tankConfigs: [{ id: Date.now().toString(), location: '頂樓戶外', material: '不鏽鋼', orientation: '直式', tonnage: '1', count: 1, isRaised: false, hasMotor: false }],
      bathroomCount: 1,
      kitchenCount: 1,
      waterSourceTypes: ['自來水'],
      waterHeaterType: '無',
      tankConditionTags: [],
      pipeBeforeStatus: '保養',
      pipeAfterStatus: '改善明顯',
      subjective_tags: [],
      bookingDate: new Date().toLocaleDateString('en-CA'),
      bookingSlot: '早',
      serviceDate: new Date().toLocaleDateString('en-CA'),
      workDurationHours: 2,
      travelMode: '單程',
      travelBaseMinutes: 30, // Default 30 min single trip
      travelMinutesCalculated: 30,
      serviceNote: '',
      // Legacy Defaults
      arrival_time: '09:30',
      consumables: { citric_acid: 1, chemical: 0 },
      financial: { total_amount: 0, payment_method: '現金', invoice_issued: false, extra_items: [] }
    };

    // Ensure New Fields Exist (Migration Logic)
    if (!base.financial) {
      base.financial = { 
        total_amount: base.totalPaid || 0, 
        payment_method: base.paymentMethod || '現金', 
        invoice_issued: base.invoiceNeeded || false,
        extra_items: base.extraChargeItems?.map((i: any, idx: number) => ({ id: `legacy-${idx}`, ...i })) || []
      };
    } else if (!base.financial.extra_items) {
      base.financial.extra_items = [];
    }

    if (!base.consumables) {
      base.consumables = { 
        citric_acid: base.citricAcidCans || 0, 
        chemical: base.otherChemicalCans || 0 
      };
    }

    if (!base.subjective_tags) base.subjective_tags = [];
    if (base.travelBaseMinutes === undefined) base.travelBaseMinutes = 30;
    
    // Arrival time fix
    if (!base.arrival_time) {
        base.arrival_time = base.arrivalTimePreset === '其他' ? '10:00' : (base.arrivalTimePreset || '09:30');
    }

    return base as Job;
  });

  // UI State - Use optional chaining for safety
  const [showExtra, setShowExtra] = React.useState((job.financial?.extra_items?.length || 0) > 0);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [showTimeModal, setShowTimeModal] = React.useState(false);
  const [tempTime, setTempTime] = React.useState(job.arrival_time);
  const [countdown, setCountdown] = React.useState(2);
  
  // Traffic Override State
  const [isTrafficOverride, setIsTrafficOverride] = React.useState(!!job.travelMinutesOverride);
  
  // Subjective Tags State
  const [customTagInput, setCustomTagInput] = React.useState('');
  const [showCustomTagInput, setShowCustomTagInput] = React.useState(false);

  // --- Helpers ---
  const update = (u: Partial<Job>) => setJob(p => ({ ...p, ...u }));
  const isSelected = (s: ServiceItem) => job.serviceItems.includes(s);

  // Tank Helpers
  const addTank = () => {
    update({ tankConfigs: [...job.tankConfigs, { id: Date.now().toString(), location: '頂樓戶外', material: '不鏽鋼', orientation: '直式', tonnage: '1', count: 1, isRaised: false, hasMotor: false }] });
  };
  const updateTank = (idx: number, field: keyof TankConfig, val: any) => {
    const newTanks = [...job.tankConfigs];
    (newTanks[idx] as any)[field] = val;
    update({ tankConfigs: newTanks });
  };
  const removeTank = (idx: number) => {
    if (job.tankConfigs.length <= 1) return;
    update({ tankConfigs: job.tankConfigs.filter((_, i) => i !== idx) });
  };

  // Wait Days Calc
  const waitDays = Math.max(0, Math.floor((new Date(job.serviceDate).getTime() - new Date(job.bookingDate).getTime()) / (1000 * 3600 * 24)));

  // Travel Calc Logic
  React.useEffect(() => {
    if (job.travelMinutesOverride) {
      update({ travelMinutesCalculated: job.travelMinutesOverride });
    } else {
      const base = job.travelBaseMinutes || 30;
      const multiplier = job.travelMode === '來回' ? 2 : 1;
      update({ travelMinutesCalculated: base * multiplier });
    }
  }, [job.travelMode, job.travelBaseMinutes, job.travelMinutesOverride]);

  const handleTrafficOverride = (val: number) => {
    update({ travelMinutesOverride: val, travelMinutesCalculated: val });
  };

  const toggleTrafficOverrideMode = () => {
    if (isTrafficOverride) {
      // Turn off override -> revert to formula
      update({ travelMinutesOverride: undefined });
      const base = job.travelBaseMinutes || 30;
      const multiplier = job.travelMode === '來回' ? 2 : 1;
      update({ travelMinutesCalculated: base * multiplier });
      setIsTrafficOverride(false);
    } else {
      // Turn on override -> keep current calculated as starting point
      update({ travelMinutesOverride: job.travelMinutesCalculated });
      setIsTrafficOverride(true);
    }
  };

  // Submit Logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.jobs.save(job);
    
    setShowSuccessModal(true);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSave(job);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // --- Components ---

  // 1. Time Selector (Native Modal)
  const TimeSelector = () => {
    const presets = ['09:00', '09:30', '13:00', '13:30'];
    const isPreset = presets.includes(job.arrival_time);

    return (
      <>
        <div className="flex gap-2 mt-2 flex-wrap">
          {presets.map(t => (
            <button 
              key={t} 
              type="button" 
              onClick={() => update({ arrival_time: t })}
              className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${job.arrival_time === t ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}
            >
              {t}
            </button>
          ))}
          <button 
            type="button"
            onClick={() => { setTempTime(job.arrival_time); setShowTimeModal(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-black border-2 flex items-center gap-1 transition-all ${!isPreset ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}
          >
            <Clock size={14} /> 
            {!isPreset ? job.arrival_time : '其他'}
          </button>
        </div>

        {/* Time Picker Modal */}
        {showTimeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl border-4 border-[#e8dcb9]">
                <h3 className="text-xl font-black text-[#5d4a36] mb-4 text-center">選擇抵達時間</h3>
                <div className="flex justify-center mb-6">
                   <input 
                     type="time" 
                     className="text-4xl font-black text-[#5d4a36] p-4 bg-slate-50 rounded-2xl border-2 border-[#e8dcb9] outline-none focus:border-[#78b833]"
                     value={tempTime}
                     onChange={(e) => setTempTime(e.target.value)}
                   />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <button 
                     type="button"
                     onClick={() => setShowTimeModal(false)}
                     className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                   >
                     取消
                   </button>
                   <button 
                     type="button"
                     onClick={() => { update({ arrival_time: tempTime }); setShowTimeModal(false); }}
                     className="py-3 rounded-xl font-bold text-white bg-[#78b833] hover:bg-[#5a8d26] shadow-sm"
                   >
                     套用
                   </button>
                </div>
             </div>
          </div>
        )}
      </>
    );
  };

  // 2. Stepper Component
  const Stepper = ({ value, onChange, max = 10 }: { value: number, onChange: (v: number) => void, max?: number }) => (
    <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full border border-slate-200">
      <button 
        type="button" 
        onClick={() => onChange(Math.max(0, value - 0.5))}
        className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100 active:scale-95 text-slate-500"
      >
        <Minus size={16} strokeWidth={3} />
      </button>
      <span className="font-mono font-black text-lg w-12 text-center text-[#5d4a36]">{value}</span>
      <button 
        type="button" 
        onClick={() => onChange(Math.min(max, value + 0.5))}
        className="w-8 h-8 flex items-center justify-center bg-[#78b833] text-white rounded-full shadow-sm active:scale-95"
      >
        <Plus size={16} strokeWidth={3} />
      </button>
    </div>
  );

  // 3. Chip Component
  const Chip = ({ label, active, onClick, color = 'green' }: any) => (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all ${active ? `bg-${color}-100 border-${color}-300 text-${color}-800 shadow-sm` : 'bg-white border-slate-100 text-slate-400'}`}>
      {label}
    </button>
  );

  // 4. Subjective Tag Component
  const SubjectiveTagSection = () => {
    const predefined = [
      { cat: '客戶', tags: ['好客人', '奧客', '很急', '愛殺價'] },
      { cat: '現場', tags: ['乾淨整潔', '空間擁擠', '環境骯髒', '施工不方便', '車不好停'] },
      { cat: '溝通', tags: ['好溝通', '難聯絡', '管理室繁瑣'] },
    ];

    const toggleTag = (t: string) => {
      if (job.subjective_tags.includes(t)) {
        update({ subjective_tags: job.subjective_tags.filter(tag => tag !== t) });
      } else {
        update({ subjective_tags: [...job.subjective_tags, t] });
      }
    };

    const addCustomTag = () => {
      if (customTagInput.trim()) {
        toggleTag(customTagInput.trim());
        setCustomTagInput('');
        setShowCustomTagInput(false);
      }
    };

    return (
      <div className="pt-4 border-t-2 border-slate-100 mt-4">
         <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#b59a7a] flex items-center gap-1">
              <Tag size={12}/> 主觀回報（現場感受）
            </label>
            <span className="text-[10px] text-slate-300">可複選，回家再補也行</span>
         </div>
         <div className="space-y-3">
           {predefined.map((group) => (
             <div key={group.cat} className="flex gap-2 overflow-x-auto pb-1 items-center">
               <span className="text-[10px] font-bold text-slate-400 shrink-0 w-8">{group.cat}</span>
               {group.tags.map(tag => (
                 <button 
                   key={tag} 
                   type="button"
                   onClick={() => toggleTag(tag)}
                   className={`px-2 py-1 rounded-lg text-[10px] font-bold border shrink-0 transition-colors ${job.subjective_tags.includes(tag) ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                 >
                   {tag}
                 </button>
               ))}
             </div>
           ))}
           <div className="flex gap-2 items-center">
             <span className="text-[10px] font-bold text-slate-400 shrink-0 w-8">自訂</span>
             {showCustomTagInput ? (
               <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                 <input 
                   autoFocus
                   className="input-nook py-1 px-2 text-xs w-24"
                   value={customTagInput}
                   onChange={e => setCustomTagInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                   onBlur={() => { if(!customTagInput) setShowCustomTagInput(false); }}
                 />
                 <button type="button" onClick={addCustomTag} className="bg-[#78b833] text-white p-1 rounded-full"><Plus size={12}/></button>
               </div>
             ) : (
               <button 
                 type="button" 
                 onClick={() => setShowCustomTagInput(true)}
                 className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-white border-dashed border-slate-300 text-slate-400 hover:bg-slate-50"
               >
                 + 其他
               </button>
             )}
             {/* Show selected custom tags that aren't in predefined lists */}
             {job.subjective_tags.filter(t => !predefined.some(g => g.tags.includes(t))).map(t => (
               <button 
                 key={t}
                 type="button"
                 onClick={() => toggleTag(t)}
                 className="px-2 py-1 rounded-lg text-[10px] font-bold border shrink-0 bg-orange-100 border-orange-300 text-orange-700"
               >
                 {t}
               </button>
             ))}
           </div>
         </div>
      </div>
    );
  };

  if (showSuccessModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white rounded-[2rem] p-8 border-4 border-[#e8dcb9] shadow-2xl max-w-sm w-full mx-4 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner border-4 border-white">
            🚀
          </div>
          <h3 className="text-xl font-black text-[#5d4a36] mb-2">任務完成！</h3>
          <p className="text-sm font-bold text-[#b59a7a] mb-6">辛苦了，下一站加油！</p>
          
          <button 
            onClick={() => onSave(job)} 
            className="w-full bg-[#78b833] text-white py-3 rounded-xl font-black text-lg shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none transition-all"
          >
            好的 ({countdown})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-40 animate-in slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-3 bg-white border-4 border-[#e8dcb9] rounded-2xl text-[#b59a7a] hover:bg-[#fffdf5]"><ArrowLeft size={24} /></button>
        <div>
          <h2 className="text-3xl font-black text-[#5d4a36]">任務回報單</h2>
          <p className="text-xs font-bold text-[#b59a7a]">村民: {initialCustomer?.displayName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Date & Time & Travel */}
        <div className="ac-card p-5 bg-[#fffbf0]">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-black text-[#5d4a36]"><Calendar size={20}/> 時間與交通</div>
              <div className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded">等待 {waitDays} 天</div>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-[#b59a7a]">預約日期</label>
                <input type="date" className="input-nook py-2 text-sm" value={job.bookingDate} onChange={e => update({ bookingDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#b59a7a]">施工日期</label>
                <input type="date" className="input-nook py-2 text-sm" value={job.serviceDate} onChange={e => update({ serviceDate: e.target.value })} />
              </div>
           </div>

           <div className="mb-4">
              <label className="text-xs font-bold text-[#b59a7a]">抵達時間</label>
              <TimeSelector />
           </div>

           {/* Traffic Section (P0 Requirement) */}
           <div className="bg-white p-3 rounded-2xl border border-[#e8dcb9]">
              <div className="flex items-center justify-between mb-2">
                 <label className="text-xs font-bold text-[#b59a7a] flex items-center gap-1"><Car size={14}/> 交通時數</label>
                 {!isTrafficOverride ? (
                   <button type="button" onClick={toggleTrafficOverrideMode} className="text-[10px] text-slate-300 underline hover:text-[#78b833]">手動修改</button>
                 ) : (
                   <button type="button" onClick={toggleTrafficOverrideMode} className="text-[10px] text-orange-400 underline hover:text-orange-600">恢復自動計算</button>
                 )}
              </div>
              
              <div className="flex items-center gap-3">
                 {isTrafficOverride ? (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <input 
                           type="number" 
                           className="input-nook py-1 px-2 w-full text-center" 
                           value={job.travelMinutesCalculated} 
                           onChange={e => handleTrafficOverride(parseInt(e.target.value) || 0)} 
                         />
                         <span className="text-xs font-bold text-slate-400 shrink-0">分鐘 (總計)</span>
                      </div>
                    </div>
                 ) : (
                    <>
                      <div className="flex-1">
                         <div className="relative">
                           <input 
                             type="number" 
                             className="input-nook py-1 px-2 pr-8 text-center" 
                             value={job.travelBaseMinutes || ''} 
                             onChange={e => update({ travelBaseMinutes: parseInt(e.target.value) || 0 })} 
                             placeholder="30"
                           />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">分</span>
                         </div>
                         <div className="text-[9px] text-center text-slate-400 mt-1">單程時間</div>
                      </div>
                      <div className="flex flex-col gap-1">
                         <button type="button" onClick={() => update({ travelMode: '單程' })} className={`px-2 py-1 text-[10px] rounded border ${job.travelMode==='單程' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50'}`}>單程</button>
                         <button type="button" onClick={() => update({ travelMode: '來回' })} className={`px-2 py-1 text-[10px] rounded border ${job.travelMode==='來回' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50'}`}>來回</button>
                      </div>
                    </>
                 )}
                 
                 <div className="w-px h-10 bg-slate-100 mx-1"></div>
                 
                 <div className="flex-1 text-center">
                    <div className="text-2xl font-black text-[#5d4a36]">
                       {job.travelMinutesCalculated > 0 ? (job.travelMinutesCalculated / 60).toFixed(1) : '—'}
                    </div>
                    <div className="text-[9px] font-bold text-[#b59a7a]">小時</div>
                 </div>
              </div>
           </div>
        </div>

        {/* 2. Service Config */}
        <div className="ac-card p-5 bg-white">
           <div className="flex items-center gap-2 font-black text-[#5d4a36] mb-4"><Wrench size={20}/> 服務內容</div>
           
           <div className="flex gap-4 mb-6">
              {[ServiceItem.TANK, ServiceItem.PIPE].map(item => (
                <label key={item} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-4 cursor-pointer transition-all ${isSelected(item) ? 'border-[#78b833] bg-[#f0fdf4]' : 'border-[#e8dcb9] bg-white opacity-60'}`}>
                   <input type="checkbox" className="hidden" checked={isSelected(item)} onChange={() => update({ serviceItems: isSelected(item) ? job.serviceItems.filter(i => i !== item) : [...job.serviceItems, item] })} />
                   <span className="font-black text-[#5d4a36]">{item}</span>
                </label>
              ))}
           </div>

           {/* Tank Details */}
           {isSelected(ServiceItem.TANK) && (
             <div className="space-y-4 animate-in fade-in">
               {job.tankConfigs.map((tank, idx) => (
                 <div key={tank.id} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 relative">
                    <div className="absolute right-2 top-2">
                       {idx > 0 && <button type="button" onClick={() => removeTank(idx)}><Trash2 size={16} className="text-red-300 hover:text-red-500"/></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                       <div>
                         <label className="text-[10px] font-bold text-slate-400">位置</label>
                         <select className="w-full bg-white border rounded px-2 py-1 text-sm font-bold" value={tank.location} onChange={e => updateTank(idx, 'location', e.target.value)}>
                           {['頂樓戶外', '頂樓室內', '一樓戶外', '一樓室內', '陽台外', '地下室'].map(o => <option key={o}>{o}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-400">形式</label>
                         <div className="flex gap-1">
                           <button type="button" onClick={() => updateTank(idx, 'orientation', '直式')} className={`flex-1 py-1 text-xs border rounded ${tank.orientation==='直式'?'bg-blue-100 border-blue-300':'bg-white'}`}>直式</button>
                           <button type="button" onClick={() => updateTank(idx, 'orientation', '橫式')} className={`flex-1 py-1 text-xs border rounded ${tank.orientation==='橫式'?'bg-blue-100 border-blue-300':'bg-white'}`}>橫式</button>
                         </div>
                       </div>
                    </div>
                    <div className="mb-3">
                       <label className="text-[10px] font-bold text-slate-400">噸數</label>
                       <div className="flex flex-wrap gap-1">
                         {['1', '1.5', '2', '3', '5+'].map(t => (
                           <button key={t} type="button" onClick={() => updateTank(idx, 'tonnage', t)} className={`px-3 py-1 text-xs font-bold border rounded-lg ${tank.tonnage === t ? 'bg-[#78b833] text-white' : 'bg-white'}`}>{t}噸</button>
                         ))}
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-1 border bg-white px-2 py-1 rounded-lg">
                          <button type="button" onClick={() => updateTank(idx, 'count', Math.max(1, tank.count - 1))}>-</button>
                          <span className="font-black w-6 text-center">{tank.count}</span>
                          <button type="button" onClick={() => updateTank(idx, 'count', tank.count + 1)}>+</button>
                          <span className="text-xs">顆</span>
                       </div>
                       <div className="flex gap-2">
                          <button type="button" onClick={() => updateTank(idx, 'isRaised', !tank.isRaised)} className={`text-xs px-2 py-1 rounded border ${tank.isRaised ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white'}`}>架高</button>
                          <button type="button" onClick={() => updateTank(idx, 'hasMotor', !tank.hasMotor)} className={`text-xs px-2 py-1 rounded border ${tank.hasMotor ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white'}`}>馬達</button>
                       </div>
                    </div>
                 </div>
               ))}
               <button type="button" onClick={addTank} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-50">+ 新增另一組水塔</button>
             </div>
           )}

           {/* Pipe Details */}
           {isSelected(ServiceItem.PIPE) && (
             <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-200 animate-in fade-in">
                <div className="grid grid-cols-2 gap-4 mb-4">
                   <div>
                      <label className="text-xs font-bold text-[#b59a7a]">衛浴數</label>
                      <input type="number" step="0.5" className="input-nook py-1" value={job.bathroomCount} onChange={e => update({ bathroomCount: parseFloat(e.target.value) })} />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-[#b59a7a]">廚房數</label>
                      <input type="number" className="input-nook py-1" value={job.kitchenCount} onChange={e => update({ kitchenCount: parseInt(e.target.value) })} />
                   </div>
                </div>
                <div className="mb-2">
                   <label className="text-xs font-bold text-[#b59a7a]">熱水器</label>
                   <div className="flex flex-wrap gap-1 mt-1">
                      {['瓦斯', '電熱', '熱泵', '太陽能', '無'].map(h => (
                        <Chip key={h} label={h} active={job.waterHeaterType === h} onClick={() => update({ waterHeaterType: h as any })} color="orange" />
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* 3. Conditions & Results */}
        <div className="ac-card p-5 bg-white">
           <div className="flex items-center gap-2 font-black text-[#5d4a36] mb-4"><CheckCircle2 size={20}/> 狀況與結果</div>
           
           <div className="mb-4">
              <label className="text-xs font-bold text-[#b59a7a] block mb-2">水塔狀況 (多選)</label>
              <div className="flex flex-wrap gap-2">
                 {['輕微', '嚴重', '土灰', '水垢', '鐵鏽', '青苔', '油泥', '異物'].map(tag => (
                   <Chip key={tag} label={`#${tag}`} active={job.tankConditionTags.includes(tag)} 
                     onClick={() => update({ tankConditionTags: job.tankConditionTags.includes(tag) ? job.tankConditionTags.filter(t => t!==tag) : [...job.tankConditionTags, tag] })} 
                     color="red" 
                   />
                 ))}
              </div>
           </div>

           {isSelected(ServiceItem.PIPE) && (
             <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-100">
                <div>
                   <label className="text-xs font-bold text-[#b59a7a] block mb-1">清洗前</label>
                   <select className="w-full bg-slate-50 border rounded p-2 text-sm font-bold" value={job.pipeBeforeStatus} onChange={e => update({ pipeBeforeStatus: e.target.value as any })}>
                      <option>保養</option><option>半堵</option><option>全堵</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-[#b59a7a] block mb-1">清洗後</label>
                   <select className="w-full bg-slate-50 border rounded p-2 text-sm font-bold" value={job.pipeAfterStatus} onChange={e => update({ pipeAfterStatus: e.target.value as any })}>
                      <option>改善明顯</option><option>持平</option><option>改善有限</option>
                   </select>
                </div>
             </div>
           )}

           {/* P0: Subjective Tags */}
           <SubjectiveTagSection />
        </div>

        {/* 4. Cost & Financials */}
        <div className="ac-card p-5 bg-[#fffbf0]">
           <div className="flex items-center gap-2 font-black text-[#5d4a36] mb-4"><Receipt size={20}/> 成本與費用</div>
           
           {/* Consumables Group */}
           <div className="bg-white p-4 rounded-3xl border border-[#e8dcb9] mb-6 space-y-4">
             <div className="flex items-center justify-between">
               <label className="text-xs font-bold text-[#b59a7a] flex items-center gap-1">🍋 檸檬酸 <span className="text-[10px] bg-slate-100 px-1 rounded">罐</span></label>
               <Stepper 
                 value={job.consumables.citric_acid} 
                 onChange={v => update({ consumables: { ...job.consumables, citric_acid: v } })} 
                 max={6}
               />
             </div>
             <div className="flex items-center justify-between border-t border-slate-100 pt-3">
               <label className="text-xs font-bold text-[#b59a7a] flex items-center gap-1">🧪 專用藥劑 <span className="text-[10px] bg-slate-100 px-1 rounded">罐</span></label>
               <Stepper 
                 value={job.consumables.chemical} 
                 onChange={v => update({ consumables: { ...job.consumables, chemical: v } })} 
                 max={4}
               />
             </div>
             <div className="flex items-center justify-between border-t border-slate-100 pt-3">
               <label className="text-xs font-bold text-[#b59a7a]">施工工時 <span className="text-[10px] bg-slate-100 px-1 rounded">hr</span></label>
               <input 
                 type="number" 
                 step="0.5" 
                 className="input-nook py-1 w-24 text-center" 
                 value={job.workDurationHours} 
                 onChange={e => update({ workDurationHours: parseFloat(e.target.value) })} 
               />
             </div>
           </div>

           {/* Main Financials */}
           <div className="bg-[#fcfdec] p-5 rounded-3xl border-2 border-[#d9e6c3] flex flex-col gap-4 mb-4">
              <div className="flex items-center justify-between">
                 <span className="font-black text-[#5a8d26] text-lg">實收總額</span>
                 <div className="flex items-center gap-1 border-b-2 border-[#78b833]">
                   <span className="text-2xl text-[#78b833] font-black">$</span>
                   <input 
                     type="number" 
                     value={job.financial.total_amount || ''} 
                     onChange={e => update({ financial: { ...job.financial, total_amount: parseInt(e.target.value) || 0 } })} 
                     className="text-4xl font-black text-[#78b833] w-32 text-right bg-transparent outline-none p-0" 
                     placeholder="0"
                   />
                 </div>
              </div>
              
              {job.financial.invoice_issued && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 bg-orange-50 p-2 rounded-lg">
                  <AlertCircle size={12} /> 提醒：請確認金額是否已含稅
                </div>
              )}

              <div className="flex gap-2">
                 {['現金', '轉帳', '其他'].map(m => (
                   <button 
                     key={m}
                     type="button" 
                     onClick={() => update({ financial: { ...job.financial, payment_method: m as any } })} 
                     className={`flex-1 py-2 rounded-xl font-black text-xs border-b-4 active:border-b-0 active:translate-y-1 ${job.financial.payment_method === m ? 'bg-[#78b833] text-white border-[#5a8d26]' : 'bg-white text-[#b59a7a] border-[#e8dcb9]'}`}
                   >
                     {m}
                   </button>
                 ))}
              </div>
              
              <div className="flex justify-end">
                <label className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer select-none transition-all ${job.financial.invoice_issued ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                  <input type="checkbox" className="hidden" checked={job.financial.invoice_issued} onChange={e => update({ financial: { ...job.financial, invoice_issued: e.target.checked } })} />
                  <span className="text-xs font-black">{job.financial.invoice_issued ? '已開立發票' : '未開發票'}</span>
                </label>
              </div>
           </div>

           {/* Collapsible Extra Section */}
           <div>
             <button type="button" onClick={() => setShowExtra(!showExtra)} className="text-xs font-bold text-slate-400 underline decoration-dashed flex items-center gap-1 hover:text-[#78b833] mb-2">
               {showExtra ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
               {showExtra ? '收合費用補充' : '展開費用補充 (追加項目)'}
             </button>
             
             {showExtra && (
               <div className="animate-in slide-in-from-top-2 space-y-2">
                 {(job.financial.extra_items || []).map((item, idx) => (
                   <div key={item.id} className="flex gap-2 items-center">
                     <input 
                       className="input-nook py-2 text-sm flex-1" 
                       placeholder="項目名稱" 
                       value={item.name}
                       onChange={e => {
                         const newItems = [...(job.financial.extra_items || [])];
                         newItems[idx].name = e.target.value;
                         update({ financial: { ...job.financial, extra_items: newItems } });
                       }}
                     />
                     <input 
                       type="number"
                       className="input-nook py-2 text-sm w-24 text-center" 
                       placeholder="$" 
                       value={item.amount}
                       onChange={e => {
                         const newItems = [...(job.financial.extra_items || [])];
                         newItems[idx].amount = parseInt(e.target.value) || 0;
                         update({ financial: { ...job.financial, extra_items: newItems } });
                       }}
                     />
                     <button 
                       type="button" 
                       onClick={() => update({ financial: { ...job.financial, extra_items: job.financial.extra_items.filter((_, i) => i !== idx) } })}
                       className="p-2 text-red-300 hover:text-red-500"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))}
                 <button 
                   type="button" 
                   onClick={() => update({ financial: { ...job.financial, extra_items: [...(job.financial.extra_items || []), { id: Date.now().toString(), name: '', amount: 0 }] } })} 
                   className="text-xs font-bold text-[#78b833] flex items-center gap-1 hover:bg-[#f0fdf4] px-2 py-1 rounded"
                 >
                   <Plus size={14} /> 新增追加項目
                 </button>
               </div>
             )}
           </div>
        </div>

        {/* Submit */}
        <button type="submit" className="w-full bg-[#78b833] text-white font-black text-xl py-4 rounded-2xl border-b-8 border-[#5a8d26] active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3 shadow-lg">
           <Save size={24} /> 任務完成，領取獎勵！
        </button>

      </form>
    </div>
  );
};

export default JobManagement;

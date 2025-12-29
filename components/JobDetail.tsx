
import React from 'react';
import { Job, Customer, JobStatus, ServiceItem, AvatarType } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import { 
  ArrowLeft, Edit3, Calendar, Clock, MapPin, Phone, 
  Wrench, Beaker, DollarSign, FileText, Building2, CheckCircle2, User, Share2, Printer, Zap, ArrowRight, Trash2, Car, Droplets, Tag, CreditCard, Receipt, Waves, AlertCircle
} from 'lucide-react';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  onEdit: () => void;
  // [REFACTOR] Mandatory
  onViewCustomer: (customerId: string) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack, onEdit, onViewCustomer }) => {
  const [customer, setCustomer] = React.useState<Customer | undefined>();
  const canWrite = auth.canWrite();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  React.useEffect(() => {
    const fetchCustomer = async () => {
      const c = await db.customers.get(job.customerId);
      setCustomer(c);
    };
    fetchCustomer();
  }, [job.customerId]);

  const getAvatarInfo = (type: AvatarType) => {
    switch (type) {
      case 'grandpa': return { icon: '👴', color: 'bg-stone-100' };
      case 'grandma': return { icon: '👵', color: 'bg-orange-100' };
      case 'man': return { icon: '👨', color: 'bg-blue-100' };
      case 'woman': return { icon: '👩', color: 'bg-pink-100' };
      case 'boy': return { icon: '👦', color: 'bg-green-100' };
      case 'girl': return { icon: '👧', color: 'bg-yellow-100' };
      case 'building': return { icon: '🏢', color: 'bg-slate-200' };
      case 'factory': return { icon: '🏭', color: 'bg-slate-300' };
      case 'angel': return { icon: '😇', color: 'bg-amber-100 ring-2 ring-yellow-400' };
      case 'devil': return { icon: '😈', color: 'bg-purple-100 ring-2 ring-purple-400' };
      default: return { icon: '👨', color: 'bg-blue-100' };
    }
  };

  const handleViewProfile = () => {
    console.log('[TRACE][JobDetail] Profile Clicked', job.customerId);
    
    if (!job.customerId) {
        alert("此任務尚未綁定村民 (No customerId)");
        return;
    }

    if (onViewCustomer) {
      onViewCustomer(job.customerId);
    } else {
      console.error('[TRACE][JobDetail] onViewCustomer missing');
    }
  };

  const renderAvatar = (c: Customer | undefined) => {
    let emoji = '👨';
    let color = 'bg-slate-200';
    
    if (c?.avatar) {
        if ((c.avatar as string).includes('|')) {
            const parts = (c.avatar as string).split('|');
            emoji = parts[0];
            color = parts[1];
        } else {
            const info = getAvatarInfo(c.avatar);
            emoji = info.icon;
            color = info.color;
        }
    }

    return (
      <button 
        onClick={handleViewProfile}
        className={`w-20 h-20 rounded-[2rem] border-4 border-white flex items-center justify-center text-4xl shadow-xl relative transition-transform active:scale-95 hover:scale-105 ${color}`}
      >
        {emoji}
      </button>
    );
  };

  const getTotalAmount = () => {
    const val = job.financial?.total_amount ?? job.totalPaid ?? 0;
    return auth.maskSensitiveData(val.toLocaleString(), 'money');
  };

  const handleDelete = () => {
    db.jobs.delete(job.jobId);
    setShowDeleteConfirm(false);
    onBack();
  };

  return (
    <div className="max-w-4xl mx-auto pb-40 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        title="刪除任務紀錄？"
        message="這筆完工紀錄將被刪除，但仍可在變更紀錄中檢視。"
        isDanger
        confirmText="確認刪除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white border-2 border-[#eeeada] rounded-2xl text-[#8c6e4a] shadow-sm hover:scale-105 transition-all">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-black text-[#5d4a36]">任務詳情</h2>
        </div>
        {canWrite && (
          <div className="flex gap-3">
             <button onClick={() => setShowDeleteConfirm(true)} className="p-3 bg-red-50 border-2 border-red-100 rounded-2xl text-red-500 hover:bg-red-100 transition-colors">
                <Trash2 size={20} />
             </button>
             <button onClick={onEdit} className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl font-black flex items-center gap-2 border-2 border-blue-100 hover:bg-blue-100 transition-all shadow-sm">
               <Edit3 size={20} /> 修改
             </button>
          </div>
        )}
      </header>

      <div className="space-y-6">
        
        {/* Top Summary Card */}
        <div className="ac-bubble p-8 bg-white relative overflow-hidden border-t-[8px] border-t-[#78b833]">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
               {renderAvatar(customer)}
               <div className="cursor-pointer hover:opacity-70 transition-opacity" onClick={handleViewProfile}>
                  <h3 className="text-2xl font-black text-[#5d4a36]">{customer?.displayName || job.contactPerson}</h3>
                  <div className="text-sm font-bold text-slate-400">{job.serviceDate} • {job.arrival_time || '未定'} 抵達</div>
               </div>
             </div>
             <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</div>
                <div className="text-3xl font-black text-[#78b833]">${getTotalAmount()}</div>
             </div>
          </div>
          
          {/* ... Stats Grid ... */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Clock size={10}/> 施工工時</div>
                <div className="font-black text-[#5d4a36]">{job.workDurationHours} hr</div>
             </div>
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Car size={10}/> 交通時數</div>
                <div className="font-black text-[#5d4a36]">{job.travelMinutesCalculated > 0 ? (job.travelMinutesCalculated/60).toFixed(1) : '-'} hr</div>
             </div>
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Beaker size={10}/> 檸檬酸</div>
                <div className="font-black text-[#5d4a36]">{job.consumables?.citric_acid ?? job.citricAcidCans ?? 0} 罐</div>
             </div>
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Beaker size={10}/> 藥劑</div>
                <div className="font-black text-[#5d4a36]">{job.consumables?.chemical ?? job.otherChemicalCans ?? 0} 罐</div>
             </div>
          </div>
        </div>

        {/* ... Rest of the detail view remains same, but wrapping with React Fragment to ensure valid XML return if I were omitting ... */}
        {/* For this response I will include the full content to be safe as per instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
           <div className={`ac-bubble p-6 bg-white h-full ${!job.serviceItems.includes(ServiceItem.TANK) ? 'opacity-50 grayscale' : ''}`}>
              <h4 className="text-sm font-black text-[#5d4a36] mb-4 flex items-center gap-2">
                 <Droplets size={16} className="text-blue-400"/> 水塔配置
                 {!job.serviceItems.includes(ServiceItem.TANK) && <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded">未施作</span>}
              </h4>
              {job.serviceItems.includes(ServiceItem.TANK) && (
                <>
                  <div className="space-y-3 mb-6">
                     {job.tankConfigs.map((tank, i) => (
                        <div key={i} className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                           <span className="text-sm font-bold text-blue-900">{tank.tonnage}噸 {tank.material}</span>
                           <div className="flex gap-2 text-xs">
                              <span className="bg-white px-2 py-1 rounded text-blue-500 font-bold">{tank.location}</span>
                              <span className="bg-white px-2 py-1 rounded text-blue-500 font-bold">{tank.count}顆</span>
                              {tank.hasMotor && <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">馬達</span>}
                           </div>
                        </div>
                     ))}
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                     <h5 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1"><AlertCircle size={12}/> 水塔狀況</h5>
                     <div className="flex flex-wrap gap-2">
                        {job.tankConditionTags && job.tankConditionTags.length > 0 ? (
                           job.tankConditionTags.map(t => (
                              <span key={t} className="bg-red-50 text-red-500 px-2 py-1 rounded-lg text-xs font-bold border border-red-100">
                                 #{t}
                              </span>
                           ))
                        ) : (
                           <span className="text-xs text-slate-300 italic">未填寫狀況</span>
                        )}
                     </div>
                  </div>
                </>
              )}
           </div>

           <div className={`ac-bubble p-6 bg-white h-full ${!job.serviceItems.includes(ServiceItem.PIPE) ? 'opacity-50 grayscale' : ''}`}>
              <h4 className="text-sm font-black text-[#5d4a36] mb-4 flex items-center gap-2">
                 <Waves size={16} className="text-cyan-500"/> 水管配置
                 {!job.serviceItems.includes(ServiceItem.PIPE) && <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded">未施作</span>}
              </h4>
              {job.serviceItems.includes(ServiceItem.PIPE) && (
                <div className="space-y-3">
                   <div className="flex justify-between items-center bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                      <span className="text-sm font-bold text-cyan-900">格局</span>
                      <div className="flex gap-2 text-xs">
                         <span className="bg-white px-2 py-1 rounded text-cyan-600 font-bold">{job.bathroomCount} 衛</span>
                         <span className="bg-white px-2 py-1 rounded text-cyan-600 font-bold">{job.kitchenCount} 廚</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-center bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                      <span className="text-sm font-bold text-cyan-900">熱水器</span>
                      <span className="bg-white px-2 py-1 rounded text-cyan-600 font-bold text-xs">{job.waterHeaterType || '未填寫'}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="text-xs text-center p-2 bg-slate-50 rounded-lg">
                         <span className="block text-slate-400 mb-1">清洗前</span>
                         <span className="font-bold text-[#5d4a36]">{job.pipeBeforeStatus || '-'}</span>
                      </div>
                      <div className="text-xs text-center p-2 bg-green-50 rounded-lg border border-green-100">
                         <span className="block text-green-400 mb-1">清洗後</span>
                         <span className="font-bold text-green-700">{job.pipeAfterStatus || '-'}</span>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
           
        <div className="ac-bubble p-6 bg-white">
            <h4 className="text-sm font-black text-[#5d4a36] mb-4 flex items-center gap-2"><Receipt size={16} className="text-orange-400"/> 財務明細</h4>
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                <span className="text-slate-400">付款方式</span>
                <span className="font-bold text-[#5d4a36]">{job.financial?.payment_method || job.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm">
                <span className="text-slate-400">發票開立</span>
                <span className="font-bold text-[#5d4a36]">{job.financial?.invoice_issued || job.invoiceNeeded ? '已開立' : '未開立'}</span>
                </div>
                {(job.financial?.extra_items || []).length > 0 && (
                <div className="border-t border-dashed pt-2 mt-2">
                    <div className="text-xs text-slate-400 mb-1">追加項目</div>
                    {job.financial?.extra_items?.map((ex, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold text-orange-600">
                        <span>{ex.name}</span>
                        <span>+${auth.maskSensitiveData(ex.amount, 'money')}</span>
                    </div>
                    ))}
                </div>
                )}
            </div>
        </div>

        <div className="ac-bubble p-8 bg-[#fdfaf0] border-[#eeeada] border-4">
          <div className="mb-6">
             <h4 className="text-sm font-black text-[#5d4a36] mb-3 flex items-center gap-2">
                <Tag size={16} className="text-[#78b833]"/> 主觀感受
             </h4>
             <div className="flex flex-wrap gap-2">
                {[...(job.subjective_tags || [])].map(t => (
                   <span key={t} className="bg-white px-3 py-1.5 rounded-xl border-2 border-[#e8dcb9] text-xs font-bold text-[#b59a7a]">
                      #{t}
                   </span>
                ))}
                {[...(job.subjective_tags || [])].length === 0 && (
                   <span className="text-xs text-slate-300 italic">無紀錄</span>
                )}
             </div>
          </div>
          
          <div>
            <h4 className="text-sm font-black text-[#5d4a36] mb-3 flex items-center gap-2">
               <FileText size={16} className="text-slate-400" /> 現場施作詳述
            </h4>
            <div className="bg-white/80 p-6 rounded-3xl min-h-[100px] font-bold text-[#5d4a36] leading-loose border-2 border-[#eeeada] shadow-inner italic">
               {job.serviceNote || '此案件尚未填寫備註。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;

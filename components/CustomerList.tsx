
import React from 'react';
import { Customer, AvatarType, Job, JobStatus, ServiceItem } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Plus, Search, MapPin, Phone, User, Edit3, Trash2, ChevronRight, Tag, Clock, Users, Building2, Share2, MessageCircle, Facebook, Instagram, Globe, Calendar, DollarSign, History, Lock } from 'lucide-react';

interface CustomerListProps {
  onAdd: () => void;
  onEdit: (c: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onAdd, onEdit }) => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewingCustomer, setViewingCustomer] = React.useState<Customer | null>(null);
  const [viewingJobId, setViewingJobId] = React.useState<string | null>(null);
  
  const canWrite = auth.canWrite();

  React.useEffect(() => {
    setCustomers(db.customers.getAll());
    setJobs(db.jobs.getAll());
  }, []);

  const filtered = customers.filter(c => 
    c.displayName.includes(searchTerm) || 
    c.phones.some(p => p.number.includes(searchTerm)) ||
    c.customer_id.includes(searchTerm) ||
    c.addresses.some(a => a.text.includes(searchTerm))
  );

  const handleDelete = (id: string) => {
    if (!canWrite) return;
    if (!confirm("確定要刪除這位客戶嗎？此操作可由變更紀錄追溯。")) return;
    db.customers.delete(id);
    setCustomers(db.customers.getAll());
    setViewingCustomer(null);
  };

  // Helpers with Masking
  const getPrimaryPhone = (c: Customer) => {
    const raw = c.phones.find(p => p.isPrimary)?.number || c.phones[0]?.number || '無電話';
    return auth.maskSensitiveData(raw, 'phone');
  };
  const getPrimaryAddress = (c: Customer) => {
    const raw = c.addresses.find(a => a.isPrimary)?.text || c.addresses[0]?.text || '無地址';
    return auth.maskSensitiveData(raw, 'address');
  };
  
  const getReferrerName = (refId: string) => customers.find(c => c.customer_id === refId)?.displayName || '未知村民';

  // Tag Aggregation Logic
  const getAggregatedTags = (customerId: string) => {
    const customerJobs = jobs.filter(j => j.customerId === customerId);
    const tagCounts: Record<string, number> = {};
    
    customerJobs.forEach(j => {
      [...j.tankConditionTags, ...j.subjective_tags].forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([tag]) => tag);
  };

  // Job History Logic
  const getCustomerHistory = (customerId: string) => {
    return jobs
      .filter(j => j.customerId === customerId && j.status === JobStatus.COMPLETED)
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
      .slice(0, 5);
  };

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

  const renderAvatar = (c: Customer, size: 'sm' | 'lg' = 'sm') => {
    let emoji = '👨';
    let color = 'bg-slate-200';
    
    if (c.avatar && (c.avatar as string).includes('|')) {
       const parts = (c.avatar as string).split('|');
       emoji = parts[0];
       color = parts[1];
    } else {
       const info = getAvatarInfo(c.avatar);
       emoji = info.icon;
       color = info.color;
    }

    const containerClass = size === 'sm' 
      ? `w-14 h-14 rounded-full border-2 border-[#eeeada] flex items-center justify-center text-2xl shadow-sm relative ${color}`
      : `w-24 h-24 rounded-[2rem] border-4 border-white flex items-center justify-center text-5xl shadow-xl relative ${color}`;
    
    const statusEmoji = c.interactionStatus === 'angel' ? '😇' : c.interactionStatus === 'devil' ? '😈' : null;

    return (
      <div className={containerClass}>
        {emoji}
        {statusEmoji && (
          <div className={`absolute -top-1 -right-1 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center ${size === 'sm' ? 'w-6 h-6 text-xs' : 'w-10 h-10 text-xl'}`}>
            {statusEmoji}
          </div>
        )}
      </div>
    );
  };

  const renderSocialIcon = (platform: string) => {
    switch (platform) {
      case 'LINE': return <div className="bg-[#06C755] p-1.5 rounded-lg text-white"><MessageCircle size={16} /></div>;
      case 'FB': return <div className="bg-[#1877F2] p-1.5 rounded-lg text-white"><Facebook size={16} /></div>;
      case 'IG': return <div className="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-1.5 rounded-lg text-white"><Instagram size={16} /></div>;
      case '官網': return <div className="bg-slate-700 p-1.5 rounded-lg text-white"><Globe size={16} /></div>;
      default: return <div className="bg-slate-400 p-1.5 rounded-lg text-white"><Share2 size={16} /></div>;
    }
  };

  // Job History Popup
  const JobHistoryPopup = ({ jobId }: { jobId: string }) => {
    const job = jobs.find(j => j.jobId === jobId);
    if (!job) return null;
    const amount = job.financial?.total_amount || job.totalPaid || 0;

    return (
       <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 shadow-2xl border-4 border-[#e8dcb9] z-20 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
             <div className="flex items-center gap-2">
               <Calendar className="text-[#b59a7a]" size={20}/>
               <span className="text-lg font-black text-[#5d4a36]">{job.serviceDate}</span>
             </div>
             <button onClick={() => setViewingJobId(null)} className="p-1 bg-slate-100 rounded-full"><ChevronRight className="rotate-90" /></button>
          </div>
          <div className="space-y-3">
             <div className="flex justify-between items-center bg-[#fcfdec] p-3 rounded-xl border border-[#d9e6c3]">
                <span className="text-sm font-bold text-[#5a8d26]">實收金額</span>
                <span className="text-xl font-black text-[#78b833]">${auth.maskSensitiveData(amount.toLocaleString(), 'money')}</span>
             </div>
             <div>
                <span className="text-xs font-bold text-slate-400">服務項目</span>
                <div className="flex gap-2 mt-1">
                   {job.serviceItems.map(s => <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">{s}</span>)}
                </div>
             </div>
             {job.serviceNote && (
               <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 italic border border-slate-100">
                  "{job.serviceNote}"
               </div>
             )}
          </div>
       </div>
    );
  };

  return (
    <div className="space-y-8 px-4">
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="ac-bubble bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0 animate-in zoom-in-95 duration-200 relative">
            
            {/* Header / Passport Top */}
            <div className="bg-[#78b833] p-6 text-white relative overflow-hidden">
               <div className="absolute -right-10 -top-10 text-white/10 rotate-12"><User size={200} /></div>
               <button onClick={() => setViewingCustomer(null)} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 text-white z-10">✕</button>
               
               <div className="flex items-center gap-6 relative z-0">
                 {renderAvatar(viewingCustomer, 'lg')}
                 <div>
                   <div className="inline-block px-2 py-0.5 bg-black/20 rounded text-[10px] font-bold mb-1 tracking-widest uppercase">Passport</div>
                   <h3 className="text-3xl font-black">{viewingCustomer.displayName}</h3>
                   <div className="flex items-center gap-2 mt-1 opacity-90">
                     <span className="text-sm font-bold">{viewingCustomer.customer_id}</span>
                     {viewingCustomer.is_returning && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black border border-white/30">VIP 回流</span>}
                   </div>
                 </div>
               </div>
            </div>

            <div className="p-8">
               {/* Contact & Social */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b-2 border-dashed border-slate-100 pb-8">
                 <div className="space-y-4">
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                       <h4 className="text-xs font-black text-orange-400 uppercase mb-2 flex items-center gap-1"><Phone size={12}/> 聯絡資訊</h4>
                       <div className="space-y-2">
                          {viewingCustomer.phones.map((p, i) => (
                             <div key={i} className="flex justify-between items-center">
                                <span className={`font-black ${p.isPrimary ? 'text-xl text-[#5d4a36]' : 'text-sm text-slate-400'}`}>{auth.maskSensitiveData(p.number, 'phone')}</span>
                                <span className="text-[10px] bg-white px-2 py-0.5 rounded border text-slate-400">{p.label}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                    <div>
                       <h4 className="text-xs font-black text-slate-300 uppercase mb-2 flex items-center gap-1"><MapPin size={12}/> 居住地址</h4>
                       <p className="font-bold text-[#5d4a36]">{getPrimaryAddress(viewingCustomer)}</p>
                       <p className="text-xs text-slate-400 mt-1">{viewingCustomer.building_type} {viewingCustomer.has_elevator ? '(有電梯)' : ''}</p>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                       <h4 className="text-xs font-black text-blue-400 uppercase mb-2 flex items-center gap-1"><Share2 size={12}/> 來源與社群</h4>
                       <div className="flex flex-wrap gap-2 mb-3">
                          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
                             來自：{viewingCustomer.source?.channel || '未知'}
                          </span>
                          {viewingCustomer.source?.channel === '介紹' && viewingCustomer.source.referrerCustomerId && (
                             <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-bold border border-green-100 flex items-center gap-1">
                                <User size={10}/> 介紹人: {getReferrerName(viewingCustomer.source.referrerCustomerId)}
                             </span>
                          )}
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {viewingCustomer.socialAccounts?.length > 0 ? viewingCustomer.socialAccounts.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                              {renderSocialIcon(s.platform)}
                              <div>
                                 <div className="text-[10px] text-slate-400 leading-none mb-0.5">{s.platform} {s.platform === 'LINE' && s.lineChannelType ? `(${s.lineChannelType})` : ''}</div>
                                 <div className="text-xs font-black text-slate-600">{s.displayName}</div>
                              </div>
                            </div>
                          )) : <div className="text-xs text-slate-300 italic">尚無社群資料</div>}
                       </div>
                    </div>
                 </div>
               </div>

               {/* Tags & History */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                  {viewingJobId && <JobHistoryPopup jobId={viewingJobId} />}
                  
                  <div>
                     <h4 className="text-sm font-black text-[#5d4a36] mb-4 flex items-center gap-2"><Tag size={16} className="text-[#78b833]"/> 智慧標籤統計</h4>
                     <div className="flex flex-wrap gap-2">
                        {getAggregatedTags(viewingCustomer.customer_id).length > 0 ? getAggregatedTags(viewingCustomer.customer_id).map(tag => (
                           <span key={tag} className="bg-[#f0fdf4] text-[#15803d] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#dcfce7] shadow-sm">
                              #{tag}
                           </span>
                        )) : <span className="text-xs text-slate-400 italic">累積更多工單後自動分析</span>}
                     </div>
                  </div>

                  <div>
                     <h4 className="text-sm font-black text-[#5d4a36] mb-4 flex items-center gap-2"><History size={16} className="text-orange-400"/> 最近造訪紀錄</h4>
                     <div className="space-y-2">
                        {getCustomerHistory(viewingCustomer.customer_id).length > 0 ? getCustomerHistory(viewingCustomer.customer_id).map(job => (
                           <button 
                             key={job.jobId} 
                             onClick={() => setViewingJobId(job.jobId === viewingJobId ? null : job.jobId)}
                             className="w-full bg-white border-2 border-slate-100 hover:border-orange-200 p-3 rounded-xl flex items-center justify-between group transition-all"
                           >
                              <div className="flex items-center gap-3">
                                 <div className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{job.serviceDate}</div>
                                 <div className="flex gap-1">
                                    {job.serviceItems.includes(ServiceItem.TANK) && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                                    {job.serviceItems.includes(ServiceItem.PIPE) && <span className="w-2 h-2 rounded-full bg-orange-400"></span>}
                                 </div>
                              </div>
                              <div className="font-black text-[#5d4a36] group-hover:text-orange-500">
                                ${auth.maskSensitiveData((job.financial?.total_amount || job.totalPaid || 0).toLocaleString(), 'money')}
                              </div>
                           </button>
                        )) : <div className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl">尚無完工紀錄</div>}
                     </div>
                  </div>
               </div>
            </div>

            {/* Actions */}
            {canWrite && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button onClick={() => onEdit(viewingCustomer)} className="ac-btn-green flex-1 py-3 flex items-center justify-center gap-2 text-lg">
                    <Edit3 size={20} /> 修改資料
                 </button>
                 <button onClick={() => handleDelete(viewingCustomer.customer_id)} className="bg-white text-red-400 border-2 border-red-100 px-6 py-3 rounded-2xl font-bold hover:bg-red-50 transition-all">
                    <Trash2 size={24} />
                 </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Main List View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
          <Users className="text-[#78b833]" size={32} /> 村民管理
        </h2>
        {canWrite ? (
          <button onClick={onAdd} className="ac-btn-green px-8 py-3 flex items-center gap-2 shadow-xl scale-105 active:scale-95">
            <Plus size={24} /> 新增村民
          </button>
        ) : (
          <button disabled className="bg-slate-100 text-slate-400 px-8 py-3 flex items-center gap-2 rounded-2xl font-bold cursor-not-allowed">
            <Lock size={20} /> 無新增權限
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#b59a7a]" size={20} />
        <input
          type="text"
          placeholder="搜尋名稱、電話、地址或編號..."
          className="w-full pl-14 pr-6 py-4 ac-bubble border-none outline-none font-bold text-[#5d4a36] text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🍃</div>
           <p className="font-bold">找不到相符的村民</p>
           {canWrite && <p className="text-xs mt-2">試試新增一位？</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(c => (
            <div key={c.customer_id} onClick={() => setViewingCustomer(c)} className="ac-bubble p-6 hover:scale-[1.02] transition-all cursor-pointer group bg-white">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  {renderAvatar(c, 'sm')}
                  <div>
                    <h3 className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] line-clamp-1">{c.displayName}</h3>
                    <div className="text-[9px] font-bold text-[#b59a7a] uppercase tracking-tighter">{c.customer_id}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#b59a7a]">
                  <Phone size={12} /> {getPrimaryPhone(c)}
                </div>
                <div className="flex items-start gap-2 text-xs font-bold text-[#b59a7a]">
                  <MapPin size={12} className="mt-1 shrink-0" />
                  <span className="line-clamp-1">{getPrimaryAddress(c)}</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                 <div className="flex flex-wrap gap-1 max-w-[80%]">
                   {getAggregatedTags(c.customer_id).slice(0, 2).map(tag => (
                     <span key={tag} className="text-[8px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-black">#{tag}</span>
                   ))}
                 </div>
                 <ChevronRight className="text-[#eeeada] group-hover:text-[#78b833]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerList;

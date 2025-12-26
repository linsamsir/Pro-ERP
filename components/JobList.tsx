
import React from 'react';
import { Job, JobStatus, AvatarType, ServiceItem } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import { Plus, Search, Calendar, User, Clock, Edit3, Trash2, DollarSign, FileText, ChevronRight, Droplets, Wrench, Lock } from 'lucide-react';

interface JobListProps {
  onAdd: () => void;
  onEdit: (job: Job) => void;
  onView: (job: Job) => void;
}

const JobList: React.FC<JobListProps> = ({ onAdd, onEdit, onView }) => {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const canWrite = auth.canWrite();

  React.useEffect(() => {
    setJobs(db.jobs.getAll());
  }, []);

  const getCustomer = (cid: string) => db.customers.get(cid);

  // Fix Search: Include Phone Check
  const filtered = jobs.filter(j => {
    const cust = getCustomer(j.customerId);
    const searchLower = searchTerm.toLowerCase();
    
    // Check Job ID
    if (j.jobId.toLowerCase().includes(searchLower)) return true;
    
    // Check Customer Name
    if (cust?.displayName.toLowerCase().includes(searchLower)) return true;
    
    // Check Customer Phone (Fix)
    if (cust?.phones.some(p => p.number.includes(searchTerm))) return true;
    
    // Check Contact Person on Job
    if (j.contactPerson?.toLowerCase().includes(searchLower)) return true;

    return false;
  }).sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

  const handleDelete = () => {
    if (deleteId) {
      db.jobs.delete(deleteId);
      setJobs(db.jobs.getAll());
      setDeleteId(null);
    }
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

  const renderAvatar = (cid: string) => {
    const c = getCustomer(cid);
    
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
      <div className={`w-12 h-12 rounded-xl border-2 border-[#eeeada] flex items-center justify-center text-xl shadow-sm relative ${color}`}>
        {emoji}
      </div>
    );
  };

  const getTotalAmount = (job: Job) => {
    const val = job.financial?.total_amount ?? job.totalPaid ?? 0;
    return auth.maskSensitiveData(val.toLocaleString(), 'money');
  };

  const getCombinedTags = (job: Job) => {
    return [...(job.subjective_tags || []), ...(job.tankConditionTags || [])].slice(0, 3);
  };

  return (
    <div className="space-y-8 px-4">
      <ConfirmDialog 
        isOpen={!!deleteId}
        title="刪除任務紀錄？"
        message="這筆完工紀錄將被刪除，但仍可在變更紀錄中檢視。"
        isDanger
        confirmText="確認刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
          <FileText className="text-[#78b833]" size={32} /> 村莊任務
        </h2>
        {canWrite ? (
          <button onClick={onAdd} className="ac-btn-green px-8 py-3 flex items-center gap-2 font-black shadow-xl scale-105 active:scale-95 transition-transform">
            <Plus size={24} /> 快速回報
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
          placeholder="搜尋村民電話、姓名或工單編號..."
          className="w-full pl-14 pr-6 py-4 ac-bubble border-none font-bold text-lg outline-none focus:ring-4 focus:ring-[#78b833]/10 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🥥</div>
           <p className="font-bold">目前沒有符合的任務</p>
           {canWrite && <p className="text-xs mt-2">去喝杯咖啡，或新增一筆？</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(job => (
            <div 
              key={job.jobId} 
              onClick={() => onView(job)} 
              className="ac-bubble p-5 hover:translate-y-[-4px] hover:shadow-xl transition-all cursor-pointer group bg-white border-[#f2edd4] hover:border-[#78b833]/30 relative overflow-hidden"
            >
              {/* Status Badge */}
              <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black tracking-widest uppercase ${
                  job.status === JobStatus.COMPLETED ? 'bg-[#78b833] text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                  {job.status}
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {renderAvatar(job.customerId)}
                  <div>
                    <h3 className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] transition-colors leading-tight">
                      {getCustomer(job.customerId)?.displayName || job.contactPerson}
                    </h3>
                    <div className="text-xs font-bold text-slate-400 mt-0.5">{job.serviceDate}</div>
                  </div>
                </div>
                <div className="text-right pt-6">
                  <div className="text-2xl font-black text-[#78b833]">
                    ${getTotalAmount(job)}
                  </div>
                </div>
              </div>

              <div className="bg-[#fcfdec] p-3 rounded-xl border border-[#d9e6c3] flex justify-between items-center mb-4">
                 <div className="flex gap-2">
                   {job.serviceItems.includes(ServiceItem.TANK) && (
                     <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                       <Droplets size={12}/> 水塔
                     </div>
                   )}
                   {job.serviceItems.includes(ServiceItem.PIPE) && (
                     <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                       <Wrench size={12}/> 水管
                     </div>
                   )}
                 </div>
                 <div className="text-[10px] font-bold text-slate-400">
                   {job.arrival_time} 抵達
                 </div>
              </div>

              <div className="flex justify-between items-center">
                 <div className="flex gap-1 flex-wrap">
                   {getCombinedTags(job).map(t => (
                     <span key={t} className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">#{t}</span>
                   ))}
                 </div>
                 {canWrite && (
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={(e) => { e.stopPropagation(); setDeleteId(job.jobId); }} 
                       className="p-1.5 text-slate-200 hover:text-red-400 transition-colors"
                       title="刪除"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobList;

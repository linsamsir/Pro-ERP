
import React from 'react';
import { Job, JobStatus, AvatarType, ServiceItem, Customer } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import { Plus, Search, FileText, Lock, Loader2, Trash2, Droplets, Wrench, AlertTriangle } from 'lucide-react';

interface JobListProps {
  onAdd: () => void;
  onEdit: (job: Job) => void;
  onView: (job: Job) => void;
  // [REFACTOR] Mandatory prop
  onViewCustomer: (customerId: string) => void;
}

const JobList: React.FC<JobListProps> = ({ onAdd, onEdit, onView, onViewCustomer }) => {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [customerMap, setCustomerMap] = React.useState<Record<string, Customer>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const canWrite = auth.canWrite();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jData, cData] = await Promise.all([
         db.jobs.list({ q: searchTerm }),
         db.customers.getAll()
      ]);
      setJobs(jData);
      
      const map: Record<string, Customer> = {};
      cData.forEach(c => map[c.customer_id] = c);
      setCustomerMap(map);

    } catch (err: any) {
      console.error("Failed to fetch jobs", err);
      setError(err.message || "讀取任務失敗");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(fetchData, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDelete = async () => {
    if (deleteId) {
      await db.jobs.delete(deleteId);
      await fetchData();
      setDeleteId(null);
    }
  };

  const getTotalAmount = (job: Job) => {
    const val = job.financial?.total_amount ?? job.totalPaid ?? 0;
    return auth.maskSensitiveData(val.toLocaleString(), 'money');
  };

  const getAvatarInfo = (type: AvatarType) => {
    switch (type) {
      case 'grandpa': return { icon: '👴', color: 'bg-stone-100' };
      case 'grandma': return { icon: '👵', color: 'bg-orange-100' };
      case 'man': return { icon: '👨', color: 'bg-blue-100' };
      case 'woman': return { icon: '👩', color: 'bg-pink-100' };
      default: return { icon: '🏠', color: 'bg-slate-100' };
    }
  };

  // [REFACTOR] Unified click handler for customers
  const handleCustomerClick = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation(); // Stop bubbling to job view
    console.log('[TRACE][JobList] Customer Click:', customerId);
    
    if (!customerId) {
        alert("資料錯誤：此任務未綁定 customerId");
        return;
    }
    
    if (onViewCustomer) {
        onViewCustomer(customerId);
    } else {
        console.error('[TRACE][JobList] FATAL: onViewCustomer missing');
    }
  };

  const renderAvatar = (customerId: string) => {
     const c = customerMap[customerId];
     const info = getAvatarInfo(c?.avatar || 'man');
     return (
        <div 
          onClick={(e) => handleCustomerClick(e, customerId)}
          className={`w-12 h-12 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-2xl hover:scale-110 transition-transform cursor-pointer ${info.color}`}
        >
           {info.icon}
        </div>
     );
  };

  return (
    <div className="space-y-8 px-4">
      <ConfirmDialog 
        isOpen={!!deleteId}
        title="刪除任務紀錄？"
        message="這筆完工紀錄將被刪除。"
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
          <button onClick={onAdd} className="ac-btn-green px-8 py-3 flex items-center gap-2 font-black shadow-xl">
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

      {error && (
        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 flex items-center gap-4 text-red-600">
           <AlertTriangle size={32}/>
           <div>
              <div className="font-black text-lg">資料讀取發生錯誤</div>
              <div className="text-sm">{error}</div>
           </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
           <Loader2 className="animate-spin mb-2" size={40}/>
           <p className="font-bold">任務資料載入中...</p>
        </div>
      ) : jobs.length === 0 && !error ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🥥</div>
           <p className="font-bold">目前沒有符合的任務</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div 
              key={job.jobId} 
              onClick={() => onView(job)} 
              className="ac-bubble p-5 hover:translate-y-[-4px] hover:shadow-xl transition-all cursor-pointer group bg-white border-[#f2edd4] hover:border-[#78b833]/30 relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black tracking-widest uppercase ${
                  job.status === JobStatus.COMPLETED ? 'bg-[#78b833] text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                  {job.status}
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {renderAvatar(job.customerId)}
                  <div>
                    <h3 
                      onClick={(e) => handleCustomerClick(e, job.customerId)}
                      className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] transition-colors leading-tight hover:underline cursor-pointer z-10 relative"
                    >
                      {job.contactPerson}
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
              </div>

              {canWrite && (
                 <div className="flex justify-end">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setDeleteId(job.jobId); }} 
                     className="p-1.5 text-slate-200 hover:text-red-400 transition-colors z-20 relative"
                   >
                     <Trash2 size={16} />
                   </button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobList;

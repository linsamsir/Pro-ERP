
import React from 'react';
import { Job, ServiceItem } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Plus, FileText, Loader2, Droplets, Wrench, AlertTriangle, ChevronDown, History } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';
import { QueryDocumentSnapshot } from 'firebase/firestore';

interface JobListProps {
  onAdd: () => void;
  onEdit: (job: Job) => void;
  onView: (job: Job) => void;
}

const JobList: React.FC<JobListProps> = ({ onAdd, onEdit, onView }) => {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [daysFilter, setDaysFilter] = React.useState(60);
  
  const [viewingCustomerId, setViewingCustomerId] = React.useState<string | null>(null);
  const canWrite = auth.canWrite();

  const fetchData = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await db.jobs.getJobsPage({
        lastDoc: isLoadMore ? (lastDoc as any) : undefined,
        limitSize: 50,
        days: daysFilter
      });

      if (isLoadMore) {
        setJobs(prev => [...prev, ...result.items]);
      } else {
        setJobs(result.items);
      }
      setLastDoc(result.lastDoc as any);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message || "讀取任務失敗");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [daysFilter]);

  return (
    <div className="space-y-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
          <FileText className="text-[#78b833]" size={32} /> 村莊任務
        </h2>
        <div className="flex gap-2">
            {canWrite && (
            <button onClick={onAdd} className="ac-btn-green px-8 py-3 flex items-center gap-2 font-black shadow-xl">
                <Plus size={24} /> 快速回報
            </button>
            )}
        </div>
      </div>

      {/* Simplified Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] border-2 border-[#e8dcb9]">
         <div className="flex items-center gap-3">
            <History className="text-[#b59a7a]" size={20}/>
            <span className="font-black text-[#5d4a36]">查看最近</span>
            <select 
              value={daysFilter} 
              onChange={e => setDaysFilter(parseInt(e.target.value))}
              className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-1 font-bold outline-none focus:border-[#78b833]"
            >
              <option value={30}>30 天</option>
              <option value={60}>60 天</option>
              <option value={180}>半年</option>
              <option value={365}>一年</option>
            </select>
            <span className="font-bold text-slate-400 text-sm">的施作紀錄</span>
         </div>
         <div className="text-xs font-bold text-slate-400">
            預設顯示所有完工任務，按日期倒序排列
         </div>
      </div>

      {error && (
        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 flex items-center gap-4 text-red-600 animate-pop">
           <AlertTriangle size={32}/>
           <div>
              <div className="font-black text-lg">讀取發生錯誤</div>
              <div className="text-sm">{error}</div>
           </div>
        </div>
      )}

      {loading && !loadingMore ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
           <Loader2 className="animate-spin mb-2" size={40}/>
           <p className="font-bold">任務清單調閱中...</p>
        </div>
      ) : jobs.length === 0 && !error ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🥥</div>
           <p className="font-bold">此區間尚無施作紀錄</p>
           <button onClick={() => setDaysFilter(daysFilter + 90)} className="mt-4 text-blue-500 font-bold underline">搜尋更早之前的資料</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {jobs.map(job => (
              <div 
                key={job.jobId} 
                onClick={() => onView(job)} 
                className="ac-bubble p-5 hover:translate-y-[-4px] hover:shadow-xl transition-all cursor-pointer group bg-white border-[#f2edd4] relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black tracking-widest uppercase bg-[#78b833] text-white shadow-sm`}>
                    {job.status}
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl shadow-inner group-hover:bg-white transition-colors">👤</div>
                    <div>
                      <h3 className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] transition-colors leading-tight">{job.contactPerson}</h3>
                      <div className="text-xs font-bold text-slate-400 mt-0.5">{job.serviceDate}</div>
                    </div>
                  </div>
                  <div className="text-right pt-6">
                    <div className="text-2xl font-black text-[#78b833]">
                      ${auth.maskSensitiveData(job.financial?.total_amount || job.totalPaid || 0, 'money')}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                    {job.serviceItems?.includes(ServiceItem.TANK) && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1"><Droplets size={10}/> 水塔</span>}
                    {job.serviceItems?.includes(ServiceItem.PIPE) && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1"><Wrench size={10}/> 水管</span>}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="py-10 text-center">
              <button 
                onClick={() => fetchData(true)}
                disabled={loadingMore}
                className="bg-white border-4 border-[#e8dcb9] text-[#5d4a36] px-10 py-3 rounded-2xl font-black flex items-center gap-2 mx-auto hover:bg-[#fffdf5] shadow-sm"
              >
                {loadingMore ? <Loader2 className="animate-spin" /> : <ChevronDown />}
                {loadingMore ? '載入中...' : '載入更早的紀錄'}
              </button>
            </div>
          )}
        </>
      )}
      
      <CustomerDetailModal 
        customerId={viewingCustomerId} 
        onClose={() => setViewingCustomerId(null)} 
      />
    </div>
  );
};

export default JobList;

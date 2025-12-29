
import React from 'react';
import { Customer, Job, ServiceItem, AvatarType } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Phone, MapPin, Share2, MessageCircle, History, Loader2, Trash2, X } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  onEdit: (c: Customer) => void;
  onDelete?: (id: string) => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, onClose, onEdit, onDelete }) => {
  const [history, setHistory] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(false);
  const canWrite = auth.canWrite();

  React.useEffect(() => {
    console.log('[TRACE][Modal] MOUNTED for:', customer.customer_id);
    const loadHistory = async () => {
      if (!customer.customer_id) return;
      setLoading(true);
      try {
        const jobs = await db.jobs.list({ customerId: customer.customer_id });
        setHistory(jobs.slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
    return () => console.log('[TRACE][Modal] UNMOUNTED');
  }, [customer.customer_id]);

  const getPrimaryPhone = (c: Customer) => {
    const raw = c.phones?.find(p => p.isPrimary)?.number || c.phones?.[0]?.number || '無電話';
    return auth.maskSensitiveData(raw, 'phone');
  };

  const getPrimaryAddress = (c: Customer) => {
    const raw = c.addresses?.find(a => a.isPrimary)?.text || c.addresses?.[0]?.text || '無地址';
    return auth.maskSensitiveData(raw, 'address');
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

  const renderAvatar = (c: Customer) => {
    const info = getAvatarInfo(c.avatar || 'man');
    return (
      <div className={`w-24 h-24 rounded-[2rem] border-4 border-white flex items-center justify-center text-5xl shadow-xl relative ${info.color}`}>
        {info.icon}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="ac-bubble bg-white w-full max-w-lg p-6 relative overflow-y-auto max-h-[90vh] shadow-2xl border-4 border-[#e8dcb9]">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <X size={20} />
        </button>
        
        <div className="flex gap-4 mb-6">
          {renderAvatar(customer)}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-[#5d4a36] truncate">{customer.displayName}</h2>
            <p className="text-slate-400 font-mono text-xs mt-1 font-bold tracking-wide">{customer.customer_id}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {customer.is_returning && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-xs font-black">回流客</span>}
              {customer.interactionStatus === 'angel' && <span className="bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded text-xs font-black">天使</span>}
              {customer.interactionStatus === 'devil' && <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-black">黑名單</span>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Phone size={12}/> 主要電話</div>
            <div className="text-xl font-black text-[#5d4a36]">{getPrimaryPhone(customer)}</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> 地址</div>
            <div className="text-lg font-bold text-[#5d4a36]">{getPrimaryAddress(customer)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#f0f9ff] rounded-xl border border-blue-100">
              <div className="text-xs text-blue-400 font-bold uppercase mb-1 flex items-center gap-1"><Share2 size={12}/> 客戶來源</div>
              <div className="font-black text-blue-900 text-lg">
                {customer.source?.channel || '未填寫'}
              </div>
              {customer.source?.referrerName && <div className="text-xs text-blue-500 mt-1">介紹人: {customer.source.referrerName}</div>}
            </div>

            <div className="p-4 bg-[#f0fdf4] rounded-xl border border-green-100">
              <div className="text-xs text-green-500 font-bold uppercase mb-1 flex items-center gap-1"><MessageCircle size={12}/> 社群帳號</div>
              {customer.socialAccounts && customer.socialAccounts.length > 0 ? (
                customer.socialAccounts.map((acc, idx) => (
                  <div key={idx} className="font-bold text-green-800 text-xs truncate mt-1">
                    <span className="text-[9px] bg-white px-1 rounded border border-green-200 mr-1">{acc.platform}</span>
                    {acc.displayName}
                  </div>
                ))
              ) : (
                <div className="text-sm font-bold text-green-800/50 italic">無紀錄</div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-black text-[#5d4a36] mb-3 flex items-center gap-2">
              <History size={16} className="text-[#b59a7a]"/> 過去清洗紀錄
            </h3>
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-4 text-slate-300"><Loader2 className="animate-spin inline mr-2"/> 讀取中...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-4 text-slate-300 text-sm italic border-2 border-dashed border-slate-100 rounded-xl">尚無清洗紀錄</div>
              ) : (
                history.map(job => (
                  <div key={job.jobId} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between shadow-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg px-2 py-1 w-14 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400">{new Date(job.serviceDate).getFullYear()}</span>
                        <span className="text-sm font-black text-[#5d4a36]">{new Date(job.serviceDate).getMonth()+1}/{new Date(job.serviceDate).getDate()}</span>
                      </div>
                      <div className="flex gap-1">
                        {job.serviceItems.includes(ServiceItem.TANK) && <span className="w-2.5 h-2.5 rounded-full bg-blue-400" title="水塔"></span>}
                        {job.serviceItems.includes(ServiceItem.PIPE) && <span className="w-2.5 h-2.5 rounded-full bg-green-400" title="水管"></span>}
                        {job.serviceItems.length === 0 && <span className="w-2.5 h-2.5 rounded-full bg-orange-400" title="其他"></span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-[#5d4a36]">${auth.maskSensitiveData(job.financial?.total_amount || 0, 'money')}</div>
                      <div className="flex gap-1 justify-end mt-1">
                        {job.tankConditionTags?.slice(0, 1).map(t => <span key={t} className="text-[9px] bg-red-50 text-red-400 px-1 rounded">{t}</span>)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={() => onEdit(customer)} className="flex-1 ac-btn-green py-3 justify-center text-lg shadow-sm">修改資料</button>
            {onDelete && (
              <button onClick={() => onDelete(customer.customer_id)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors">
                <Trash2/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailModal;

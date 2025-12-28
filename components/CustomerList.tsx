
import React from 'react';
import { Customer, AvatarType, Job, JobStatus } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import ConfirmDialog from './ConfirmDialog';
import { Plus, Search, MapPin, Phone, User, Edit3, Trash2, ChevronRight, Tag, History, Lock, Loader2, AlertTriangle } from 'lucide-react';

interface CustomerListProps {
  onAdd: () => void;
  onEdit: (c: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onAdd, onEdit }) => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewingCustomer, setViewingCustomer] = React.useState<Customer | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  
  const canWrite = auth.canWrite();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cData = await db.customers.list({ q: searchTerm });
      setCustomers(cData);
    } catch (err: any) {
      console.error("Failed to load customers", err);
      setError(err.message || "讀取資料失敗");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
        fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDelete = async () => {
    if (deleteId) {
      await db.customers.delete(deleteId);
      await fetchData();
      setViewingCustomer(null);
      setDeleteId(null);
    }
  };

  // Helper Wrappers
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

  const renderAvatar = (c: Customer, size: 'sm' | 'lg' = 'sm') => {
    const info = getAvatarInfo(c.avatar || 'man');
    const containerClass = size === 'sm' 
      ? `w-14 h-14 rounded-full border-2 border-[#eeeada] flex items-center justify-center text-2xl shadow-sm relative ${info.color}`
      : `w-24 h-24 rounded-[2rem] border-4 border-white flex items-center justify-center text-5xl shadow-xl relative ${info.color}`;
    
    return <div className={containerClass}>{info.icon}</div>;
  };

  return (
    <div className="space-y-8 px-4">
      <ConfirmDialog 
        isOpen={!!deleteId}
        title="確認刪除村民？"
        message="這位村民的資料將被移至垃圾桶，但可透過變更紀錄查詢。此操作無法直接還原。"
        isDanger
        confirmText="確認刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Viewing Customer Modal (Simplified for brevity) */}
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="ac-bubble bg-white w-full max-w-lg p-6 relative animate-in zoom-in-95">
             <button onClick={() => setViewingCustomer(null)} className="absolute top-4 right-4 p-2">✕</button>
             <div className="flex gap-4 mb-6">
                {renderAvatar(viewingCustomer, 'lg')}
                <div>
                   <h2 className="text-2xl font-black">{viewingCustomer.displayName}</h2>
                   <p className="text-slate-400">{viewingCustomer.customer_id}</p>
                </div>
             </div>
             <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                   <div className="text-xs text-slate-400 font-bold uppercase mb-1">主要電話</div>
                   <div className="text-xl font-black text-[#5d4a36]">{getPrimaryPhone(viewingCustomer)}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                   <div className="text-xs text-slate-400 font-bold uppercase mb-1">地址</div>
                   <div className="text-lg font-bold text-[#5d4a36]">{getPrimaryAddress(viewingCustomer)}</div>
                </div>
             </div>
             {canWrite && (
                <div className="flex gap-3 mt-6">
                   <button onClick={() => onEdit(viewingCustomer)} className="flex-1 ac-btn-green py-3 justify-center">修改</button>
                   <button onClick={() => setDeleteId(viewingCustomer.customer_id)} className="p-3 bg-red-100 text-red-500 rounded-xl"><Trash2/></button>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Main List View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
          <User className="text-[#78b833]" size={32} /> 村民管理
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
          placeholder="搜尋名稱、電話、地址..."
          className="w-full pl-14 pr-6 py-4 ac-bubble border-none outline-none font-bold text-[#5d4a36] text-lg"
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
           <p className="font-bold">村民資料載入中...</p>
        </div>
      ) : customers.length === 0 && !error ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🍃</div>
           <p className="font-bold">找不到相符的村民</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map(c => (
            <div key={c.customer_id} onClick={() => setViewingCustomer(c)} className="ac-bubble p-6 hover:scale-[1.02] transition-all cursor-pointer group bg-white">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  {renderAvatar(c, 'sm')}
                  <div>
                    <h3 className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] line-clamp-1">{c.displayName}</h3>
                    <div className="text-[9px] font-bold text-[#b59a7a] uppercase tracking-tighter">{c.customer_id}</div>
                  </div>
                </div>
                {/* Status Badges - RESTORED */}
                <div className="flex flex-col items-end gap-1">
                   {c.is_returning && (
                      <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <History size={8}/> 回流
                      </span>
                   )}
                   {c.interactionStatus === 'angel' && <span className="text-lg" title="天使客人">😇</span>}
                   {c.interactionStatus === 'devil' && <span className="text-lg" title="黑名單">😈</span>}
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
              
              {/* Tags Section - RESTORED */}
              {c.ai_tags && c.ai_tags.length > 0 && (
                 <div className="flex gap-1 flex-wrap pt-2 border-t border-slate-100">
                    {c.ai_tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[9px] bg-slate-50 text-slate-400 px-2 py-1 rounded border border-slate-100">#{t}</span>
                    ))}
                    {c.ai_tags.length > 3 && <span className="text-[9px] text-slate-300">+{c.ai_tags.length - 3}</span>}
                 </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerList;


import React from 'react';
import { Customer, AvatarType } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Plus, Search, MapPin, Phone, User, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { TAIWAN_TERRITORY, CityName } from '../data/territory';

interface CustomerListProps {
  onAdd: () => void;
  onEdit: (c: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onAdd, onEdit }) => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Filtering
  const [activeCity, setActiveCity] = React.useState<CityName | '全部'>('全部');
  const [activeDistrict, setActiveDistrict] = React.useState('全部');
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const canWrite = auth.canWrite();

  const fetchData = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await db.customers.getCustomersPage({ 
        city: activeCity === '全部' ? undefined : activeCity, 
        district: activeDistrict === '全部' ? undefined : activeDistrict,
        lastDoc: isLoadMore ? (lastDoc as any) : undefined, 
        limitSize: 100 // 增加單次載入數量
      });

      if (isLoadMore) {
        setCustomers(prev => [...prev, ...result.items]);
      } else {
        setCustomers(result.items);
      }
      setLastDoc(result.lastDoc as any);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message || "讀取資料失敗");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  React.useEffect(() => {
    setLastDoc(null);
    fetchData();
  }, [activeCity, activeDistrict]);

  const filteredCustomers = searchTerm 
    ? customers.filter(c => 
        c.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phones.some(p => p.number.includes(searchTerm))
      )
    : customers;

  const getPrimaryPhone = (c: Customer) => auth.maskSensitiveData(c.phones?.[0]?.number || '無電話', 'phone');
  const getPrimaryAddress = (c: Customer) => auth.maskSensitiveData(c.addresses?.[0]?.text || '無地址', 'address');
  
  const getAvatarInfo = (type: AvatarType) => {
    switch (type) {
      case 'grandpa': return { icon: '👴', color: 'bg-stone-100' };
      case 'grandma': return { icon: '👵', color: 'bg-orange-100' };
      case 'man': return { icon: '👨', color: 'bg-blue-100' };
      case 'woman': return { icon: '👩', color: 'bg-pink-100' };
      default: return { icon: '🏠', color: 'bg-slate-100' };
    }
  };

  return (
    <div className="space-y-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-4xl font-black text-[#5d4a36] flex items-center gap-3">
          <User className="text-[#78b833]" size={32} /> 村民名冊
        </h2>
        {canWrite && (
          <button onClick={onAdd} className="ac-btn-green px-8 py-3 flex items-center gap-2 shadow-xl scale-105 active:scale-95">
            <Plus size={24} /> 新增村民
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#b59a7a]" size={20} />
          <input
            type="text"
            placeholder="搜尋姓名、電話 (僅限已載入清單)..."
            className="w-full pl-14 pr-6 py-4 ac-bubble border-none outline-none font-bold text-[#5d4a36] text-lg shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Territory Filter Chips */}
        <div className="flex flex-col gap-3 bg-white/50 p-4 rounded-3xl border border-[#e8dcb9]">
            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-black text-[#b59a7a] w-full mb-1">城市篩選</span>
                {['全部', '高雄市', '台南市', '屏東縣'].map(c => (
                    <button
                        key={c}
                        onClick={() => { setActiveCity(c as any); setActiveDistrict('全部'); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${activeCity === c ? 'bg-[#5d4a36] text-white border-[#5d4a36]' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                        {c}
                    </button>
                ))}
            </div>
            {activeCity !== '全部' && (
                <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
                    <span className="text-xs font-black text-[#b59a7a] w-full mb-1">行政區篩選</span>
                    <button
                        onClick={() => setActiveDistrict('全部')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${activeDistrict === '全部' ? 'bg-[#78b833] text-white' : 'bg-white text-slate-400'}`}
                    >
                        全部
                    </button>
                    {TAIWAN_TERRITORY[activeCity as CityName].map(d => (
                        <button
                            key={d}
                            onClick={() => setActiveDistrict(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${activeDistrict === d ? 'bg-[#78b833] text-white border-[#78b833]' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {error && (
        <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100 flex items-start gap-4 text-orange-700 animate-pop">
           <AlertTriangle size={32} className="shrink-0"/>
           <div>
              <div className="font-black text-lg">載入過程有誤</div>
              <div className="text-sm leading-relaxed">{error}</div>
              <button onClick={() => fetchData()} className="mt-4 bg-orange-600 text-white px-4 py-1 rounded-lg text-xs font-bold">重新載入</button>
           </div>
        </div>
      )}

      {loading && !loadingMore ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
           <Loader2 className="animate-spin mb-2" size={40}/>
           <p className="font-bold">村民檔案調閱中...</p>
        </div>
      ) : filteredCustomers.length === 0 && !error ? (
        <div className="py-20 text-center text-slate-300">
           <div className="mb-4 text-4xl">🍃</div>
           <p className="font-bold">此區域尚無村民資料</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(c => {
               const info = getAvatarInfo(c.avatar || 'man');
               return (
                <div 
                  key={c.customer_id} 
                  onClick={() => setSelectedCustomerId(c.customer_id)} 
                  className="ac-bubble p-6 hover:scale-[1.02] transition-all cursor-pointer group bg-white relative active:scale-[0.98] border-[#eeeada]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full border-2 border-[#eeeada] flex items-center justify-center text-2xl shadow-sm ${info.color}`}>{info.icon}</div>
                      <div>
                        <h3 className="text-lg font-black text-[#5d4a36] group-hover:text-[#78b833] line-clamp-1">{c.displayName}</h3>
                        <div className="text-[9px] font-bold text-[#b59a7a] uppercase tracking-tighter">{c.customer_id}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4 text-xs font-bold text-[#b59a7a]">
                    <div className="flex items-center gap-2"><Phone size={12} /> {getPrimaryPhone(c)}</div>
                    <div className="flex items-start gap-2"><MapPin size={12} className="mt-1 shrink-0" /><span className="line-clamp-1">{getPrimaryAddress(c)}</span></div>
                  </div>
                  {c.ai_tags && c.ai_tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-2 border-t border-slate-50">
                        {c.ai_tags.slice(0, 3).map(t => <span key={t} className="text-[9px] bg-slate-50 text-slate-400 px-2 py-1 rounded border border-slate-100">#{t}</span>)}
                    </div>
                  )}
                </div>
               );
            })}
          </div>

          {hasMore && (
            <div className="py-10 text-center">
              <button 
                onClick={() => fetchData(true)}
                disabled={loadingMore}
                className="bg-white border-4 border-[#e8dcb9] text-[#5d4a36] px-10 py-3 rounded-2xl font-black flex items-center gap-2 mx-auto hover:bg-[#fffdf5] disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? <Loader2 className="animate-spin" /> : <ChevronDown />}
                {loadingMore ? '載入中...' : '載入更多村民'}
              </button>
            </div>
          )}
        </>
      )}

      <CustomerDetailModal 
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onEdit={(c) => { setSelectedCustomerId(null); onEdit(c); }}
      />
    </div>
  );
};

export default CustomerList;

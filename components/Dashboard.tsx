
import React from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { auth } from '../services/auth';
import { Map, MapPin, Users, ChevronRight, Loader2 } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';
import { TAIWAN_TERRITORY, parseRegion, CityName } from '../data/territory';

interface DistrictStat {
  name: string;
  count: number;
  customers: Customer[];
}

const Dashboard: React.FC = () => {
  const [activeCity, setActiveCity] = React.useState<CityName>('高雄市');
  const [mapData, setMapData] = React.useState<Record<string, DistrictStat[]>>({});
  const [selectedDistrict, setSelectedDistrict] = React.useState<DistrictStat | null>(null);
  const [totalCustomers, setTotalCustomers] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  
  const [viewingCustomerId, setViewingCustomerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        // 1. 取得精確總數
        const count = await db.customers.getTotalCount();
        setTotalCustomers(count);

        // 2. 取得全體資料 (已在 db.ts 移除 500 限制)
        const all = await db.customers.getAll();
        
        const grouped: Record<string, Record<string, Customer[]>> = {
            '高雄市': {}, '台南市': {}, '屏東縣': {}, '其他': {}
        };

        // 初始化結構
        Object.entries(TAIWAN_TERRITORY).forEach(([city, districts]) => {
            districts.forEach(d => { grouped[city][d] = []; });
        });

        all.forEach(c => {
            // 優先使用儲存的 city/district 欄位，若無則解析地址
            const cCity = (c as any).city || parseRegion(c.addresses.find(a => a.isPrimary)?.text || c.addresses[0]?.text || '').city;
            const cDist = (c as any).district || parseRegion(c.addresses.find(a => a.isPrimary)?.text || c.addresses[0]?.text || '').district;
            
            const targetCity = grouped[cCity] ? cCity : '其他';
            if (!grouped[targetCity][cDist]) {
                grouped[targetCity][cDist] = [];
            }
            grouped[targetCity][cDist].push(c);
        });

        const finalMap: Record<string, DistrictStat[]> = {};
        Object.keys(grouped).forEach(city => {
            finalMap[city] = Object.keys(grouped[city]).map(dist => ({
                name: dist,
                count: grouped[city][dist].length,
                customers: grouped[city][dist]
            })).sort((a, b) => b.count - a.count);
        });

        setMapData(finalMap);
        
        // 預設選取當前城市中有人的第一個行政區
        if (finalMap[activeCity]?.length > 0) {
            const firstWithPeople = finalMap[activeCity].find(d => d.count > 0) || finalMap[activeCity][0];
            setSelectedDistrict(firstWithPeople);
        }
        setLoading(false);
    };
    loadData();
  }, []);

  // 當切換城市時，也更新選取的行政區
  React.useEffect(() => {
    if (mapData[activeCity]) {
       const firstWithPeople = mapData[activeCity].find(d => d.count > 0) || mapData[activeCity][0];
       setSelectedDistrict(firstWithPeople);
    }
  }, [activeCity]);

  const getTileColor = (count: number) => {
      if (count === 0) return 'bg-slate-50 border-slate-100 text-slate-200';
      if (count <= 2) return 'bg-[#ecfccb] border-[#d9f99d] text-[#3f6212]';
      if (count <= 5) return 'bg-[#bef264] border-[#84cc16] text-[#3f6212]';
      if (count <= 10) return 'bg-[#84cc16] border-[#4d7c0f] text-white';
      return 'bg-[#4d7c0f] border-[#365314] text-white';
  };

  const getTileSize = (count: number) => {
      if (count > 10) return 'col-span-2 row-span-2';
      return 'col-span-1 row-span-1';
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center p-20 text-wood-brown">
        <Loader2 className="animate-spin mb-4" size={48}/>
        <p className="font-black">繪製領地地圖中 (目前 {totalCustomers} 人)...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-pop flex flex-col h-[calc(100vh-100px)]">
      <div className="flex justify-between items-end mb-6 shrink-0">
         <div>
            <h1 className="text-h1 flex items-center gap-3">
               <Map size={36} className="text-[#78b833]"/> 村莊地圖 <span className="text-sm bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">領地分佈</span>
            </h1>
         </div>
         <div className="bg-white px-4 py-2 rounded-xl border-2 border-[#e8dcb9] shadow-sm">
            <span className="text-xs font-bold text-slate-400">目前總村民</span>
            <div className="text-2xl font-black text-[#5d4a36]">{totalCustomers} <span className="text-sm text-[#b59a7a]">人</span></div>
         </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
         <div className="flex-1 bg-white rounded-[2rem] border-4 border-[#e8dcb9] shadow-lg flex flex-col overflow-hidden">
            <div className="flex border-b-2 border-[#e8dcb9] bg-[#fbf8e6]">
               {(['高雄市', '台南市', '屏東縣'] as CityName[]).map(city => (
                  <button 
                    key={city}
                    onClick={() => setActiveCity(city)}
                    className={`flex-1 py-4 font-black text-lg transition-colors ${activeCity === city ? 'bg-white text-[#5d4a36] shadow-[0_4px_0_white]' : 'text-[#b59a7a] hover:bg-[#fffdf5]'}`}
                  >
                    {city}
                  </button>
               ))}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 auto-rows-[80px]">
                   {mapData[activeCity]?.map(d => (
                       <button 
                         key={d.name}
                         onClick={() => setSelectedDistrict(d)}
                         className={`rounded-2xl border-b-4 p-2 flex flex-col items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md ${getTileColor(d.count)} ${getTileSize(d.count)} ${selectedDistrict?.name === d.name ? 'ring-4 ring-[#78b833] ring-offset-2' : ''}`}
                       >
                          <div className="font-black text-xs md:text-sm leading-tight">{d.name}</div>
                          <div className="font-mono font-bold text-[10px] opacity-80">{d.count}</div>
                       </button>
                   ))}
                </div>
            </div>
         </div>

         <div className="w-full md:w-80 bg-white rounded-[2rem] border-2 border-[#e8dcb9] shadow-sm flex flex-col shrink-0 h-[400px] md:h-auto overflow-hidden">
            {selectedDistrict ? (
                <>
                   <div className="p-5 border-b border-[#e8dcb9] bg-[#fffbf0]">
                      <div className="text-xs font-bold text-[#b59a7a] uppercase mb-1">SELECTED TERRITORY</div>
                      <h2 className="text-2xl font-black text-[#5d4a36]">{selectedDistrict.name}</h2>
                      <div className="flex items-center gap-2 mt-2">
                         <span className="bg-[#78b833] text-white px-2 py-0.5 rounded text-[10px] font-bold">{selectedDistrict.count} 位村民</span>
                         <span className="text-[10px] text-slate-400 font-bold">{activeCity}</span>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {selectedDistrict.count === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                            <MapPin size={32} className="mb-2 opacity-30"/>
                            <p className="text-xs font-bold">尚無村民定居此區</p>
                        </div>
                      ) : (
                        selectedDistrict.customers.map(c => (
                            <div 
                              key={c.customer_id}
                              onClick={() => setViewingCustomerId(c.customer_id)}
                              className="bg-white border-2 border-slate-100 p-3 rounded-xl cursor-pointer hover:border-[#78b833] hover:bg-[#f0fdf4] transition-all group"
                            >
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl shadow-inner group-hover:bg-white">
                                     {c.avatar === 'woman' ? '👩' : '👨'}
                                  </div>
                                  <div className="min-w-0">
                                     <div className="font-black text-[#5d4a36] truncate text-sm">{c.displayName}</div>
                                     <div className="text-[10px] text-slate-400 font-mono truncate">{auth.maskSensitiveData(c.phones[0]?.number, 'phone')}</div>
                                  </div>
                                  <ChevronRight className="ml-auto text-slate-300 group-hover:text-[#78b833]" size={16}/>
                               </div>
                            </div>
                        ))
                      )}
                   </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                   <MapPin size={48} className="mb-4 opacity-50"/>
                   <p className="font-bold">點擊左側地圖區塊<br/>查看領地詳情</p>
                </div>
            )}
         </div>
      </div>

      <CustomerDetailModal 
        customerId={viewingCustomerId}
        onClose={() => setViewingCustomerId(null)}
      />
    </div>
  );
};

export default Dashboard;

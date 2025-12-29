
import React from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { auth } from '../services/auth';
import { Map, MapPin, Users, ChevronRight } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';

// --- Types ---
type City = '高雄市' | '台南市' | '屏東縣';
interface DistrictStat {
  name: string;
  count: number;
  customers: Customer[];
}

const Dashboard: React.FC = () => {
  const [activeCity, setActiveCity] = React.useState<City>('高雄市');
  const [mapData, setMapData] = React.useState<Record<string, DistrictStat[]>>({});
  const [selectedDistrict, setSelectedDistrict] = React.useState<DistrictStat | null>(null);
  const [totalCustomers, setTotalCustomers] = React.useState(0);
  
  // Local Modal State
  const [viewingCustomerId, setViewingCustomerId] = React.useState<string | null>(null);

  // --- Address Parsing Logic ---
  const parseAddress = (addr: string): { city: string, district: string } => {
    if (!addr) return { city: '未知', district: '未知' };
    
    // Regex for Taiwan Address: 3 chars for City, then District
    // Matches "高雄市" + "楠梓區"
    const regex = /(?<city>.{2}[市縣])(?<district>.+?[鄉鎮市區])/;
    const match = addr.match(regex);
    
    if (match && match.groups) {
        let { city, district } = match.groups;
        // Normalize Kaohsiung/Tainan/Pingtung
        if (city.includes('高雄')) city = '高雄市';
        if (city.includes('台南') || city.includes('臺南')) city = '台南市';
        if (city.includes('屏東')) city = '屏東縣';
        return { city, district };
    }
    
    return { city: '其他', district: '未知' };
  };

  React.useEffect(() => {
    const loadData = async () => {
        const all = await db.customers.getAll();
        setTotalCustomers(all.length);

        const grouped: Record<string, Record<string, Customer[]>> = {
            '高雄市': {}, '台南市': {}, '屏東縣': {}, '其他': {}
        };

        all.forEach(c => {
            const addr = c.addresses.find(a => a.isPrimary)?.text || c.addresses[0]?.text || '';
            const { city, district } = parseAddress(addr);
            
            const targetCity = grouped[city] ? city : '其他';
            if (!grouped[targetCity][district]) {
                grouped[targetCity][district] = [];
            }
            grouped[targetCity][district].push(c);
        });

        // Convert to Array for rendering
        const finalMap: Record<string, DistrictStat[]> = {};
        Object.keys(grouped).forEach(city => {
            finalMap[city] = Object.keys(grouped[city]).map(dist => ({
                name: dist,
                count: grouped[city][dist].length,
                customers: grouped[city][dist]
            })).sort((a, b) => b.count - a.count); // Sort by popularity
        });

        setMapData(finalMap);
        
        // Auto select top district of Kaohsiung initially if available
        if (finalMap['高雄市']?.length > 0) {
            setSelectedDistrict(finalMap['高雄市'][0]);
        }
    };
    loadData();
  }, []);

  // --- Visual Helpers ---
  const getTileColor = (count: number) => {
      if (count === 0) return 'bg-slate-100 border-slate-200 text-slate-300';
      if (count <= 2) return 'bg-[#ecfccb] border-[#d9f99d] text-[#3f6212]'; // Lime-100
      if (count <= 5) return 'bg-[#bef264] border-[#84cc16] text-[#3f6212]'; // Lime-300
      if (count <= 10) return 'bg-[#84cc16] border-[#4d7c0f] text-white'; // Lime-500
      return 'bg-[#4d7c0f] border-[#365314] text-white'; // Lime-700
  };

  const getTileSize = (count: number) => {
      // Dynamic sizing for "Heatmap" feel
      if (count > 10) return 'col-span-2 row-span-2';
      return 'col-span-1 row-span-1';
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-pop flex flex-col h-[calc(100vh-100px)]">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6 shrink-0">
         <div>
            <h1 className="text-h1 text-[#5d4a36] flex items-center gap-3">
               <Map size={36} className="text-[#78b833]"/> 村莊地圖 <span className="text-sm bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">領地分布</span>
            </h1>
         </div>
         <div className="bg-white px-4 py-2 rounded-xl border-2 border-[#e8dcb9] shadow-sm">
            <span className="text-xs font-bold text-slate-400">目前總村民</span>
            <div className="text-2xl font-black text-[#5d4a36]">{totalCustomers} <span className="text-sm text-[#b59a7a]">人</span></div>
         </div>
      </div>

      {/* Main Content: Split Layout */}
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
         
         {/* Left: Map/Tiles */}
         <div className="flex-1 bg-white rounded-[2rem] border-4 border-[#e8dcb9] shadow-lg flex flex-col overflow-hidden">
            {/* City Tabs */}
            <div className="flex border-b-2 border-[#e8dcb9] bg-[#fbf8e6]">
               {(['高雄市', '台南市', '屏東縣'] as City[]).map(city => (
                  <button 
                    key={city}
                    onClick={() => setActiveCity(city)}
                    className={`flex-1 py-4 font-black text-lg transition-colors ${activeCity === city ? 'bg-white text-[#5d4a36] shadow-[0_4px_0_white]' : 'text-[#b59a7a] hover:bg-[#fffdf5]'}`}
                  >
                    {city}
                  </button>
               ))}
            </div>
            
            {/* Tile Grid */}
            <div className="flex-1 p-6 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 auto-rows-[80px]">
                   {mapData[activeCity]?.length === 0 ? (
                       <div className="col-span-full py-20 text-center text-slate-300 font-bold">此區域尚未開拓領地</div>
                   ) : (
                       mapData[activeCity]?.map(d => (
                           <button 
                             key={d.name}
                             onClick={() => setSelectedDistrict(d)}
                             className={`rounded-2xl border-b-4 p-2 flex flex-col items-center justify-center transition-transform active:scale-95 shadow-sm hover:shadow-md ${getTileColor(d.count)} ${getTileSize(d.count)}`}
                           >
                              <div className="font-black text-sm md:text-base leading-tight">{d.name}</div>
                              <div className="font-mono font-bold text-xs opacity-80">{d.count} 人</div>
                           </button>
                       ))
                   )}
                </div>
            </div>
         </div>

         {/* Right: Info Panel */}
         <div className="w-full md:w-80 bg-white rounded-[2rem] border-2 border-[#e8dcb9] shadow-sm flex flex-col shrink-0 h-[400px] md:h-auto">
            {selectedDistrict ? (
                <>
                   <div className="p-5 border-b border-[#e8dcb9] bg-[#fffbf0] rounded-t-[1.8rem]">
                      <div className="text-xs font-bold text-[#b59a7a] uppercase mb-1">SELECTED TERRITORY</div>
                      <h2 className="text-3xl font-black text-[#5d4a36]">{selectedDistrict.name}</h2>
                      <div className="flex items-center gap-2 mt-2">
                         <span className="bg-[#78b833] text-white px-2 py-0.5 rounded text-xs font-bold">{selectedDistrict.count} 位村民</span>
                         <span className="text-xs text-slate-400 font-bold">{activeCity}</span>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {selectedDistrict.customers.map(c => (
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
                                   <div className="font-black text-[#5d4a36] truncate">{c.displayName}</div>
                                   <div className="text-xs text-slate-400 font-mono truncate">{c.phones[0]?.number}</div>
                                </div>
                                <ChevronRight className="ml-auto text-slate-300 group-hover:text-[#78b833]" size={16}/>
                             </div>
                          </div>
                      ))}
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


import React from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { auth } from '../services/auth';
import { Search, Phone, UserPlus, ArrowRight, Tent, Star, X, User, Lock } from 'lucide-react';

interface DashboardProps {
  onStartReport: (customer: Customer, phone?: string) => void;
  onAddCustomer: (phone: string) => void;
}

type SearchState = 'IDLE' | 'FOUND' | 'NOT_FOUND';

const Dashboard: React.FC<DashboardProps> = ({ onStartReport, onAddCustomer }) => {
  const [phoneInput, setPhoneInput] = React.useState('');
  const [foundCustomer, setFoundCustomer] = React.useState<Customer | null>(null);
  const [searchState, setSearchState] = React.useState<SearchState>('IDLE');
  
  const canWrite = auth.canWrite();

  // Normalize: Remove non-digits
  const normalizePhone = (p: string) => p.replace(/[^\d]/g, '');

  const handleSearch = (input: string) => {
    const cleanPhone = normalizePhone(input);
    
    if (cleanPhone.length < 4) {
      setSearchState('IDLE');
      setFoundCustomer(null);
      return;
    }

    const customers = db.customers.getAll();
    const match = customers.find(c => 
      c.phones.some(p => normalizePhone(p.number).includes(cleanPhone))
    );
    
    if (match) {
      setFoundCustomer(match);
      setSearchState('FOUND');
    } else {
      setFoundCustomer(null);
      setSearchState('NOT_FOUND');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(val);
    
    // Simple debounce/threshold logic
    if (val.length === 0) {
      setSearchState('IDLE');
      setFoundCustomer(null);
    } else {
      handleSearch(val);
    }
  };

  const clearSearch = () => {
    setPhoneInput('');
    setSearchState('IDLE');
    setFoundCustomer(null);
  };

  const getPrimaryPhone = (c: Customer) => c.phones.find(p => p.isPrimary)?.number || c.phones[0]?.number;

  const renderFoundCard = () => (
    <div 
      onClick={() => canWrite && foundCustomer && onStartReport(foundCustomer)}
      className={`bg-white border-4 border-[#78b833] p-6 rounded-[2rem] shadow-lg animate-pop relative overflow-hidden group transition-all ${canWrite ? 'cursor-pointer active:scale-[0.98]' : 'cursor-not-allowed opacity-80'}`}
    >
       <div className="absolute right-0 top-0 p-3 bg-[#78b833] text-white rounded-bl-2xl font-black text-xs z-10">
         已建檔村民
       </div>
       
       <div className="flex items-center gap-6 mb-6">
         <div className={`w-20 h-20 rounded-full flex items-center justify-center text-5xl border-4 border-[#f0fdf4] shadow-inner ${
           foundCustomer?.interactionStatus === 'angel' ? 'bg-yellow-50' : 
           foundCustomer?.interactionStatus === 'devil' ? 'bg-purple-50' : 'bg-slate-50'
         }`}>
           {foundCustomer?.avatar === 'grandpa' ? '👴' : 
            foundCustomer?.avatar === 'grandma' ? '👵' : 
            foundCustomer?.avatar === 'building' ? '🏢' : '🏠'}
           {foundCustomer?.interactionStatus === 'angel' && <span className="absolute -top-1 -right-1 text-xl">😇</span>}
           {foundCustomer?.interactionStatus === 'devil' && <span className="absolute -top-1 -right-1 text-xl">😈</span>}
         </div>
         <div className="flex-1">
           <h3 className="text-2xl font-black text-[#5d4a36] leading-tight mb-1">{foundCustomer?.displayName}</h3>
           <p className="text-lg font-bold text-[#b59a7a] font-mono tracking-wide">{getPrimaryPhone(foundCustomer!)}</p>
           <p className="text-xs font-bold text-slate-400 mt-1">上次服務: {foundCustomer?.last_service_date || '新朋友'}</p>
         </div>
       </div>

       <button 
         disabled={!canWrite}
         className={`w-full py-4 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 ${canWrite ? 'bg-[#78b833] text-white shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none' : 'bg-slate-200 text-slate-400'}`}
       >
         {canWrite ? (
           <>
             <div className="bg-white/20 p-1 rounded-lg"><Tent size={20} /></div>
             開始任務回報
           </>
         ) : (
           <>
             <Lock size={20} /> 檢視模式 (無寫入權限)
           </>
         )}
       </button>
    </div>
  );

  const renderNotFoundCard = () => (
    <div className="bg-white border-4 border-orange-200 p-6 rounded-[2rem] shadow-lg animate-pop text-center">
       <div className="inline-block p-4 bg-orange-50 rounded-full mb-4 animate-bounce">
         <div className="text-4xl">🤔</div>
       </div>
       <h3 className="text-xl font-black text-[#5d4a36] mb-1">找不到這個電話</h3>
       <p className="text-sm font-bold text-[#b59a7a] mb-6">這是一位新搬來的村民嗎？</p>
       
       <button 
         onClick={() => canWrite && onAddCustomer(phoneInput)}
         disabled={!canWrite}
         className={`w-full py-4 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 ${canWrite ? 'bg-orange-400 text-white shadow-[0_4px_0_#c2410c] active:translate-y-[4px] active:shadow-none' : 'bg-slate-200 text-slate-400'}`}
       >
         {canWrite ? <><UserPlus size={24} /> 新增村民並開始回報</> : <><Lock size={20} /> 無新增權限</>}
       </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto py-8 px-4 min-h-[80vh] flex flex-col">
      
      {/* Header */}
      <div className="text-center mb-8 pt-4">
        <h1 className="text-3xl font-black text-[#5d4a36] mb-2 flex items-center justify-center gap-2">
          <Tent size={32} className="text-[#78b833]" /> 清潔小村
        </h1>
        <p className="text-[#b59a7a] font-bold">輸入電話，立即開始今日任務</p>
      </div>

      {/* Main Input Area (Sticky-ish feel) */}
      <div className="mb-8 relative z-20">
        <div className="relative transform transition-all hover:scale-[1.02]">
           <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#d6cbb6]">
             <Phone size={32} />
           </div>
           <input 
             type="tel" 
             inputMode="numeric"
             className="w-full pl-16 pr-14 py-6 text-4xl font-black text-[#5d4a36] bg-white border-[5px] border-[#e8dcb9] rounded-full outline-none focus:border-[#78b833] transition-all placeholder:text-slate-200 shadow-xl text-center tracking-widest font-mono"
             placeholder="09..."
             value={phoneInput}
             onChange={handleInputChange}
             autoFocus
           />
           {phoneInput && (
             <button 
               onClick={clearSearch}
               className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-500 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-300 transition-colors"
             >
               <X size={24} strokeWidth={3} />
             </button>
           )}
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 transition-all duration-300">
        {searchState === 'IDLE' && (
          <div className="flex flex-col items-center justify-center h-40 opacity-40">
            <Tent size={60} className="text-[#e8dcb9] mb-4" />
            <p className="text-[#d6cbb6] font-black text-lg">等待輸入...</p>
          </div>
        )}
        
        {searchState === 'FOUND' && renderFoundCard()}
        {searchState === 'NOT_FOUND' && renderNotFoundCard()}
      </div>
    </div>
  );
};

export default Dashboard;


import React from 'react';
import { db } from '../services/db';
import { Customer, Job, JobStatus, ServiceItem } from '../types';
import { Phone, ArrowRight, Sword, UserPlus, MapPin, Loader2, X } from 'lucide-react';
import CustomerForm from './CustomerForm';

interface TodayMissionProps {
  onStartJob: (job: Job, customer: Customer) => void;
}

type Step = 'IDLE' | 'SEARCHING' | 'FOUND' | 'NOT_FOUND' | 'CREATING_CUSTOMER';

const TodayMission: React.FC<TodayMissionProps> = ({ onStartJob }) => {
  const [phone, setPhone] = React.useState('');
  const [step, setStep] = React.useState<Step>('IDLE');
  const [foundCustomer, setFoundCustomer] = React.useState<Customer | null>(null);
  // Keep data state for potential future use or background logic, though UI is removed
  const [todayJobs, setTodayJobs] = React.useState<Job[]>([]);
  
  React.useEffect(() => {
    console.log('[TodayMission] mounted');
    loadTodayJobs();
  }, []);

  const loadTodayJobs = async () => {
      try {
          const todayStr = new Date().toLocaleDateString('en-CA');
          const allJobs = await db.jobs.getAll(); 
          const filtered = allJobs.filter(j => j.serviceDate === todayStr);
          setTodayJobs(filtered);
      } catch (e) {
          console.error('[TodayMission] Failed to load today jobs', e);
      }
  };

  const normalize = (p: string) => p.replace(/[^\d]/g, '');

  const handleSearch = async () => {
    if (!phone) return;
    
    console.log('[TodayMission] start clicked, phone=', phone);
    setStep('SEARCHING');
    setFoundCustomer(null);

    setTimeout(async () => {
        try {
            const cleanPhone = normalize(phone);
            const customers = await db.customers.getAll();
            
            const match = customers.find(c => 
                c.phones.some(p => normalize(p.number).includes(cleanPhone) || p.number.includes(phone))
            );

            if (match) {
                console.log('[TodayMission] lookup result: FOUND', match.customer_id);
                setFoundCustomer(match);
                setStep('FOUND');
            } else {
                console.log('[TodayMission] lookup result: NOT_FOUND');
                setStep('NOT_FOUND');
            }
        } catch (e) {
            console.error('[TodayMission] Lookup error', e);
            setStep('IDLE'); 
        }
    }, 800);
  };

  const createTodayJob = async (customer: Customer) => {
      console.log('[TodayMission] Creating job for', customer.displayName);
      const newJob: Job = {
          jobId: db.jobs.generateId(),
          customerId: customer.customer_id,
          status: JobStatus.COMPLETED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contactPerson: customer.contactName,
          contactPhone: customer.phones[0]?.number || '',
          serviceItems: [ServiceItem.TANK],
          tankConfigs: [{ id: Date.now().toString(), location: '頂樓戶外', material: '不鏽鋼', orientation: '直式', tonnage: '1', count: 1, isRaised: false, hasMotor: false }],
          tankConditionTags: [],
          bathroomCount: 1, kitchenCount: 1,
          waterSourceTypes: ['自來水'], waterHeaterType: '無',
          pipeBeforeStatus: '保養', pipeAfterStatus: '改善明顯',
          subjective_tags: [],
          bookingDate: new Date().toLocaleDateString('en-CA'),
          bookingSlot: '早',
          serviceDate: new Date().toLocaleDateString('en-CA'),
          arrival_time: '09:30',
          workDurationHours: 2,
          travelMode: '單程', travelBaseMinutes: 30, travelMinutesCalculated: 30,
          consumables: { citric_acid: 1, chemical: 0 },
          financial: { total_amount: 0, payment_method: '現金', invoice_issued: false, extra_items: [] },
          serviceNote: ''
      };
      
      await db.jobs.save(newJob, { skipAi: true });
      onStartJob(newJob, customer);
  };

  const handleCustomerSave = async (newC: Customer) => {
      console.log('[TodayMission] New customer saved', newC.customer_id);
      await createTodayJob(newC);
  };

  const resetFlow = () => {
      setStep('IDLE');
      setPhone('');
      setFoundCustomer(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-pop flex flex-col gap-8">
      
      {/* Main Interaction Area - Centered and Focused */}
      <div className="w-full space-y-8">
          <div className="text-center">
             <div className="inline-block p-4 bg-red-100 text-red-500 rounded-full mb-4 border-4 border-white shadow-xl">
                <Sword size={40}/>
             </div>
             <h1 className="text-4xl font-black text-[#5d4a36] mb-2">今日任務中心</h1>
             <p className="text-[#b59a7a] font-bold">輸入電話，召喚村民，開始今天的冒險！</p>
          </div>

          <div className="bg-white p-2 rounded-[2rem] border-4 border-[#e8dcb9] shadow-lg flex items-center transform transition-all focus-within:scale-105 focus-within:border-red-400">
             <div className="pl-6 text-[#d6cbb6]">
                <Phone size={32}/>
             </div>
             <input 
                type="tel" 
                className="w-full text-3xl font-black text-[#5d4a36] p-4 outline-none placeholder:text-slate-200 tracking-widest"
                placeholder="0912..."
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                autoFocus
             />
             <button 
                onClick={handleSearch}
                disabled={!phone || step === 'SEARCHING'}
                className="bg-red-500 text-white p-4 rounded-[1.5rem] shadow-md hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
             >
                {step === 'SEARCHING' ? <Loader2 size={32} className="animate-spin"/> : <ArrowRight size={32} strokeWidth={3}/>}
             </button>
          </div>

          {/* Dialogue Bubbles */}
          <div className="space-y-4 max-w-2xl mx-auto">
              {step !== 'IDLE' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-[#fffbf0] border-4 border-[#e8dcb9] rounded-[2rem] rounded-tl-none p-6 shadow-sm relative ml-4">
                          <div className="absolute -left-3 -top-3 w-8 h-8 bg-red-400 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-white text-xs">🤖</div>
                          
                          {step === 'SEARCHING' && (
                              <div className="flex items-center gap-3 text-[#b59a7a] font-bold">
                                  <Loader2 className="animate-spin" /> 正在村莊名冊中翻找 {phone}...
                              </div>
                          )}

                          {step === 'FOUND' && foundCustomer && (
                              <div className="space-y-4">
                                  <div className="text-lg font-bold text-[#5d4a36]">
                                      🎉 找到村民：<span className="text-xl font-black">{foundCustomer.displayName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-slate-400">
                                      <MapPin size={16}/> {foundCustomer.addresses?.[0]?.text || '未知地址'}
                                  </div>
                                  <button 
                                      onClick={() => createTodayJob(foundCustomer)}
                                      className="w-full bg-[#78b833] text-white py-3 rounded-xl font-black text-lg shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                                  >
                                      <Sword size={20}/> 立即開始任務
                                  </button>
                                  <button onClick={resetFlow} className="text-xs text-slate-400 underline w-full">重新輸入</button>
                              </div>
                          )}

                          {step === 'NOT_FOUND' && (
                              <div className="space-y-4">
                                  <div className="text-lg font-bold text-[#5d4a36]">
                                      🍃 找不到這個電話，是一張新面孔！
                                  </div>
                                  <p className="text-sm text-[#b59a7a]">要邀請他入村並開始任務嗎？</p>
                                  <button 
                                      onClick={() => setStep('CREATING_CUSTOMER')}
                                      className="w-full bg-blue-500 text-white py-3 rounded-xl font-black text-lg shadow-[0_4px_0_#1e40af] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                                  >
                                      <UserPlus size={20}/> 新增村民並開始
                                  </button>
                                  <button onClick={resetFlow} className="text-xs text-slate-400 underline w-full">重新輸入</button>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Modal for Creating Customer */}
      {step === 'CREATING_CUSTOMER' && (
          <CustomerForm 
              mode="modal"
              initialData={{ phones: [{ number: phone, type: '手機', isPrimary: true, label: '主要' }] }}
              onCancel={() => setStep('NOT_FOUND')}
              onSave={handleCustomerSave}
          />
      )}

    </div>
  );
};

export default TodayMission;

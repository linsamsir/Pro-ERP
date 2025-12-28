
import React from 'react';
import { Customer, Preference, BuildingType, PhoneRecord, CustomerSource, SocialAccount, AvatarType } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Save, X, Plus, Trash2, User, Phone, MapPin, Share2, Search, Smile, Lock } from 'lucide-react';

interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onCancel: () => void;
  onSave: (customer: Customer) => void;
  mode?: 'page' | 'modal';
}

const CustomerForm: React.FC<CustomerFormProps> = ({ initialData, onCancel, onSave, mode = 'page' }) => {
  const isEditing = !!initialData?.customer_id;
  
  // --- Local State ---
  const [c, setC] = React.useState<Partial<Customer>>({
    customerType: '個人',
    contactName: '',
    companyName: '',
    taxId: '',
    preference: Preference.PHONE,
    phones: [{ number: '', type: '手機', isPrimary: true, label: '屋主' }],
    addresses: [{ text: '', isPrimary: true }],
    building_type: BuildingType.DETACHED,
    building_name: '',
    has_elevator: false,
    source: { channel: '電話' },
    ai_tags: [],
    is_returning: false,
    avatar: 'man',
    socialAccounts: [],
    interactionStatus: 'normal',
    ...initialData
  });

  // Source & Referral Logic State
  const [referrerSearch, setReferrerSearch] = React.useState('');
  const [showReferrerInput, setShowReferrerInput] = React.useState(false);
  const [referrerQuickName, setReferrerQuickName] = React.useState('');
  const [referrerQuickPhone, setReferrerQuickPhone] = React.useState('');
  const [allCustomers, setAllCustomers] = React.useState<Customer[]>([]);

  React.useEffect(() => {
    const loadCustomers = async () => {
      const data = await db.customers.getAll();
      setAllCustomers(data);
    };
    loadCustomers();
  }, []);

  // --- Helpers ---
  const update = (u: Partial<Customer>) => setC(prev => ({ ...prev, ...u }));
  
  const updatePhone = (index: number, field: keyof PhoneRecord, value: any) => {
    const newPhones = [...(c.phones || [])];
    if (!newPhones[index]) return;
    (newPhones[index] as any)[field] = value;
    update({ phones: newPhones });
  };

  const addPhone = () => {
    update({ phones: [...(c.phones || []), { number: '', type: '手機', isPrimary: false, label: '備用' }] });
  };

  const removePhone = (index: number) => {
    if ((c.phones || []).length <= 1) return;
    update({ phones: (c.phones || []).filter((_, i) => i !== index) });
  };

  // Social Accounts Helpers
  const addSocial = () => {
    update({ socialAccounts: [...(c.socialAccounts || []), { platform: 'LINE', displayName: '' }] });
  };

  const updateSocial = (index: number, field: keyof SocialAccount, value: any) => {
    const newSocials = [...(c.socialAccounts || [])];
    (newSocials[index] as any)[field] = value;
    update({ socialAccounts: newSocials });
  };

  const removeSocial = (index: number) => {
    update({ socialAccounts: (c.socialAccounts || []).filter((_, i) => i !== index) });
  };

  const updateSource = (u: Partial<CustomerSource>) => {
    update({ source: { ...(c.source || { channel: '電話' }), ...u } });
  };

  const handleReferrerSelect = (refId: string, refName: string) => {
    updateSource({ referrerCustomerId: refId, referrerName: refName });
    setReferrerSearch(''); 
  };

  const handleQuickReferrerAdd = async () => {
    if (!referrerQuickName || !referrerQuickPhone) return alert('請輸入介紹人姓名與電話');
    
    // Quick Add must also use atomic ID
    const newRef = await db.customers.createWithAutoId({
        customerType: '個人',
        contactName: referrerQuickName,
        displayName: referrerQuickName,
        phones: [{ number: referrerQuickPhone, type: '手機', isPrimary: true, label: '快速新增' }],
        addresses: [{ text: '', isPrimary: true }],
        building_type: BuildingType.OTHER,
        has_elevator: false,
        is_returning: false,
        ai_tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        avatar: 'man',
        socialAccounts: [],
        preference: Preference.PHONE
    });
    
    setAllCustomers(prev => [...prev, newRef]);
    handleReferrerSelect(newRef.customer_id, referrerQuickName);
    setShowReferrerInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!c.contactName) return alert("請輸入聯絡人姓名！");
    if (!c.phones?.[0]?.number) return alert("請至少輸入一組主要電話！");

    let displayName = c.contactName;
    if (c.customerType === '公司' && c.companyName) {
      displayName = `${c.companyName} ${c.contactName}`;
    }

    const payload = {
      ...(c as Customer),
      displayName,
      // Ensure timestamps
      updated_at: new Date().toISOString(),
    };

    if (isEditing && c.customer_id) {
       // Update existing
       await db.customers.save(payload);
       onSave(payload);
    } else {
       // Create new (Atomic ID)
       const newCustomer = await db.customers.createWithAutoId(payload);
       onSave(newCustomer);
    }
  };

  // Avatar Options
  const avatars: { id: AvatarType, icon: string, bg: string }[] = [
    { id: 'man', icon: '👨', bg: 'bg-blue-100' },
    { id: 'woman', icon: '👩', bg: 'bg-pink-100' },
    { id: 'grandpa', icon: '👴', bg: 'bg-stone-100' },
    { id: 'grandma', icon: '👵', bg: 'bg-orange-100' },
    { id: 'boy', icon: '👦', bg: 'bg-green-100' },
    { id: 'girl', icon: '👧', bg: 'bg-yellow-100' },
    { id: 'building', icon: '🏢', bg: 'bg-slate-200' },
    { id: 'factory', icon: '🏭', bg: 'bg-slate-300' },
    { id: 'angel', icon: '😇', bg: 'bg-amber-100' },
    { id: 'devil', icon: '😈', bg: 'bg-purple-100' },
  ];

  const isBuildingComplex = ['大樓', '華廈', '公寓'].includes(c.building_type || '');

  return (
    <div className={mode === 'modal' ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-pop" : ""}>
      <div className={`bg-[#fffbf0] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-8 border-white shadow-2xl ${mode === 'page' ? 'mx-auto' : ''}`}>
        
        {/* Header */}
        <div className="sticky top-0 bg-[#fffbf0]/95 backdrop-blur-sm p-6 border-b-2 border-[#e8dcb9] flex justify-between items-center z-10">
          <div>
            <h2 className="text-h2 text-[#5d4a36]">{isEditing ? '編輯村民' : '新增村民'}</h2>
            <p className="text-note font-bold">建立資料後自動開始回報</p>
          </div>
          <button onClick={onCancel} className="p-2 bg-white rounded-full text-[#b59a7a] hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* ID field - Simplified */}
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between opacity-70">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer ID</div>
             <div className="flex items-center gap-2 font-mono font-black text-[#5d4a36]">
                <Lock size={14} className="text-slate-400"/>
                {c.customer_id || "儲存後自動生成"}
             </div>
          </div>

          {/* Avatar Selection */}
          <div className="ac-card bg-white">
            <label className="text-note mb-3 block flex items-center gap-1"><Smile size={16}/> 選擇頭像</label>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {avatars.map(av => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => update({ avatar: av.id })}
                  className={`flex-shrink-0 w-14 h-14 rounded-full text-3xl flex items-center justify-center transition-all ${c.avatar === av.id ? `ring-4 ring-[#78b833] ${av.bg} scale-110` : `${av.bg} opacity-50 hover:opacity-100`}`}
                >
                  {av.icon}
                </button>
              ))}
            </div>
          </div>

          {/* A. Type Toggle */}
          <div className="bg-white p-2 rounded-2xl border-2 border-[#e8dcb9] flex">
             {['個人', '公司'].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => update({ customerType: type as any })}
                 className={`flex-1 py-3 rounded-xl font-black text-body transition-all ${c.customerType === type ? 'bg-[#78b833] text-white shadow-md' : 'text-[#b59a7a] hover:bg-slate-50'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            {c.customerType === '公司' && (
              <div className="animate-pop">
                 <label className="text-note ml-1 mb-1 block">公司全名</label>
                 <input className="input-nook" placeholder="例如: 帝寶管委會" value={c.companyName} onChange={e => update({ companyName: e.target.value })} />
                 <div className="mt-3 flex items-center gap-2">
                    <input type="checkbox" className="w-5 h-5 accent-[#78b833]" checked={c.invoiceNeeded} onChange={e => update({ invoiceNeeded: e.target.checked })} />
                    <span className="text-body font-bold text-[#5d4a36]">需要發票</span>
                    <input className="input-nook py-1 px-3 text-sm w-40 ml-2" placeholder="統編 (選填)" value={c.taxId} onChange={e => update({ taxId: e.target.value })} />
                 </div>
              </div>
            )}
            
            <div>
              <label className="text-note ml-1 mb-1 block">聯絡人稱呼 <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" />
                <input 
                  required
                  className="input-nook pl-12 py-3" 
                  placeholder={c.customerType === '公司' ? "例如: 林總幹事" : "例如: 陳大哥"} 
                  value={c.contactName} 
                  onChange={e => update({ contactName: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* B. Phones */}
          <div className="ac-card bg-white space-y-4">
             <label className="text-note block flex justify-between">
                <span>聯絡電話 <span className="text-red-400">*</span></span>
                <button type="button" onClick={addPhone} className="text-[#78b833] flex items-center gap-1 hover:underline font-bold"><Plus size={14} /> 新增備用</button>
             </label>
             {c.phones?.map((phone, idx) => (
               <div key={idx} className="flex gap-2 items-center">
                 <div className="w-24 shrink-0">
                    <input 
                      className="input-nook py-3 px-2 text-center text-sm bg-slate-50" 
                      placeholder="標籤"
                      value={phone.label}
                      onChange={e => updatePhone(idx, 'label', e.target.value)}
                    />
                 </div>
                 <div className="flex-1 relative">
                    <input 
                      required={idx === 0}
                      className="input-nook py-3 pl-4 font-mono text-lg" 
                      placeholder="電話號碼" 
                      value={phone.number} 
                      onChange={e => updatePhone(idx, 'number', e.target.value)}
                    />
                 </div>
                 {idx > 0 && (
                   <button type="button" onClick={() => removePhone(idx)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                 )}
               </div>
             ))}
          </div>

          {/* Social Accounts */}
          <div className="ac-card bg-white space-y-4">
             <label className="text-note block flex justify-between">
                <span>社群帳號</span>
                <button type="button" onClick={addSocial} className="text-[#78b833] flex items-center gap-1 hover:underline font-bold"><Plus size={14} /> 新增帳號</button>
             </label>
             {c.socialAccounts?.map((acc, idx) => (
               <div key={idx} className="flex flex-col gap-2 p-3 border rounded-2xl bg-slate-50">
                 <div className="flex gap-2">
                   <select 
                     className="bg-white border rounded-xl px-3 py-2 text-sm font-bold outline-none"
                     value={acc.platform}
                     onChange={e => updateSocial(idx, 'platform', e.target.value)}
                   >
                     {['LINE', 'FB', 'IG', 'Threads', '官網', 'TikTok', '其他'].map(p => <option key={p}>{p}</option>)}
                   </select>
                   <input 
                     className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm"
                     placeholder="ID / 連結 / 名稱"
                     value={acc.displayName}
                     onChange={e => updateSocial(idx, 'displayName', e.target.value)}
                   />
                   <button type="button" onClick={() => removeSocial(idx)} className="text-red-300 hover:text-red-500 px-2"><Trash2 size={18}/></button>
                 </div>
                 {acc.platform === 'LINE' && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 font-bold">LINE 類型:</span>
                      <div className="flex gap-2 flex-1 overflow-x-auto">
                        {['官方帳號', '公司手機', '闆娘手機', '老闆手機'].map(t => (
                          <button 
                            key={t}
                            type="button" 
                            onClick={() => updateSocial(idx, 'lineChannelType', t)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border whitespace-nowrap transition-colors ${acc.lineChannelType === t ? 'bg-[#06C755] text-white border-[#06C755]' : 'bg-white text-slate-500'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                 )}
               </div>
             ))}
             {(!c.socialAccounts || c.socialAccounts.length === 0) && (
               <div className="text-center py-4 text-sm text-slate-300 italic bg-slate-50 rounded-xl">點擊上方新增，紀錄客人的 LINE/FB</div>
             )}
          </div>

          {/* C. Building Info */}
          <div className="ac-card bg-white space-y-5">
             <div>
                <label className="text-note ml-1 mb-1 block">地址</label>
                <div className="relative">
                   <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" />
                   <input className="input-nook pl-12 py-3" placeholder="完整地址..." value={c.addresses?.[0]?.text} onChange={e => update({ addresses: [{ text: e.target.value, isPrimary: true }] })} />
                </div>
             </div>
             
             <div>
               <label className="text-note ml-1 mb-2 block">建物類型</label>
               <div className="flex flex-wrap gap-3">
                 {Object.values(BuildingType).map(type => (
                   <button
                     key={type}
                     type="button"
                     onClick={() => update({ building_type: type })}
                     className={`btn-option ${c.building_type === type ? 'active' : 'inactive'}`}
                   >
                     {type}
                   </button>
                 ))}
               </div>
             </div>

             {isBuildingComplex && (
               <div className="animate-pop">
                 <label className="text-note ml-1 mb-1 block">社區/大樓名稱</label>
                 <input className="input-nook bg-orange-50/50 py-3" placeholder="例如: 遠雄未來城" value={c.building_name} onChange={e => update({ building_name: e.target.value })} />
               </div>
             )}

             <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="elevator" className="w-5 h-5 accent-[#78b833]" checked={c.has_elevator} onChange={e => update({ has_elevator: e.target.checked })} />
                <label htmlFor="elevator" className="text-body font-bold text-[#5d4a36]">這棟有電梯</label>
             </div>
          </div>

          {/* D. Source (Referral/Social) */}
          <div className="bg-[#f0f9ff] p-6 rounded-3xl border-2 border-blue-100 space-y-4">
             <label className="text-note text-blue-400 ml-1 block flex items-center gap-1"><Share2 size={16} /> 客戶來源</label>
             
             <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-blue-100">
               {['電話', '社群', '介紹', '其他'].map(src => (
                 <button
                   key={src}
                   type="button"
                   onClick={() => updateSource({ channel: src as any })}
                   className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${c.source?.channel === src ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-300 hover:bg-blue-50'}`}
                   title={src}
                 >
                   {src}
                 </button>
               ))}
             </div>

             {/* Referral Detail */}
             {c.source?.channel === '介紹' && (
               <div className="space-y-3 bg-white p-4 rounded-2xl animate-pop relative shadow-sm">
                  {c.source.referrerCustomerId ? (
                    <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-200">
                       <span className="font-bold text-green-700 flex items-center gap-2 text-base"><User size={18}/> {c.source.referrerName}</span>
                       <button type="button" onClick={() => updateSource({ referrerCustomerId: undefined, referrerName: undefined })} className="text-green-400 hover:text-green-600"><X size={20} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                          className="input-nook pl-10 py-3 text-sm" 
                          placeholder="搜尋介紹人(電話/姓名)..."
                          value={referrerSearch}
                          onChange={e => setReferrerSearch(e.target.value)}
                        />
                      </div>
                      
                      {/* Search Results */}
                      {referrerSearch && (
                        <div className="max-h-40 overflow-y-auto border rounded-xl divide-y">
                           {allCustomers.filter(cust => cust.displayName.includes(referrerSearch) || cust.phones.some(p => p.number.includes(referrerSearch))).map(match => (
                             <button key={match.customer_id} type="button" onClick={() => handleReferrerSelect(match.customer_id, match.displayName)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors">
                               <span className="font-bold text-[#5d4a36] text-base">{match.displayName}</span>
                               <span className="text-xs text-slate-400 ml-2">{match.phones[0]?.number}</span>
                             </button>
                           ))}
                           <button type="button" onClick={() => setShowReferrerInput(true)} className="w-full text-center py-3 text-sm font-bold text-orange-500 hover:bg-orange-50 transition-colors">
                             找不到？快速新增介紹人
                           </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Quick Add Referrer Modal (Inner) */}
                  {showReferrerInput && !c.source.referrerCustomerId && (
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 space-y-3">
                       <p className="text-sm font-bold text-orange-700">快速建立介紹人</p>
                       <input className="w-full p-2.5 rounded-lg border border-orange-200 text-sm font-bold" placeholder="姓名" value={referrerQuickName} onChange={e => setReferrerQuickName(e.target.value)} />
                       <input className="w-full p-2.5 rounded-lg border border-orange-200 text-sm font-bold" placeholder="電話" value={referrerQuickPhone} onChange={e => setReferrerQuickPhone(e.target.value)} />
                       <div className="flex gap-3">
                         <button type="button" onClick={() => setShowReferrerInput(false)} className="flex-1 py-2 bg-white border rounded-lg text-sm font-bold text-slate-500">取消</button>
                         <button type="button" onClick={handleQuickReferrerAdd} className="flex-1 py-2 bg-orange-400 text-white rounded-lg text-sm font-bold shadow-sm">建立並綁定</button>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>

          <button type="submit" className="w-full btn-primary text-xl py-5 rounded-2xl shadow-xl">
             <Save size={24} /> ✨ 完成並開始任務
          </button>

        </form>
      </div>
    </div>
  );
};

export default CustomerForm;

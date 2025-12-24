
import React from 'react';
import { Customer, Preference, BuildingType, PhoneRecord, CustomerSource, SocialAccount, AvatarType } from '../types';
import { db } from '../services/db';
import { Save, X, Plus, Trash2, Building2, User, Phone, MapPin, Share2, Search, ArrowRight, MessageCircle, Facebook, Instagram, Globe, Smile } from 'lucide-react';

interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onCancel: () => void;
  onSave: (customer: Customer) => void;
  mode?: 'page' | 'modal';
}

const CustomerForm: React.FC<CustomerFormProps> = ({ initialData, onCancel, onSave, mode = 'page' }) => {
  // --- Local State ---
  const [c, setC] = React.useState<Partial<Customer>>({
    customer_id: db.customers.generateId(),
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
    setAllCustomers(db.customers.getAll());
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

  const handleQuickReferrerAdd = () => {
    if (!referrerQuickName || !referrerQuickPhone) return alert('請輸入介紹人姓名與電話');
    
    const newRefId = db.customers.generateId();
    const newRef: Customer = {
      customer_id: newRefId,
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
    };
    db.customers.save(newRef);
    setAllCustomers(prev => [...prev, newRef]);
    
    handleReferrerSelect(newRefId, referrerQuickName);
    setShowReferrerInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!c.contactName) return alert("請輸入聯絡人姓名！");
    if (!c.phones?.[0]?.number) return alert("請至少輸入一組主要電話！");

    let displayName = c.contactName;
    if (c.customerType === '公司' && c.companyName) {
      displayName = `${c.companyName} ${c.contactName}`;
    }

    const finalCustomer: Customer = {
      ...(c as Customer),
      displayName,
      created_at: c.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.customers.save(finalCustomer);
    onSave(finalCustomer);
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
    <div className={mode === 'modal' ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in" : ""}>
      <div className={`bg-[#fffbf0] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-8 border-white shadow-2xl ${mode === 'page' ? 'mx-auto' : ''}`}>
        
        {/* Header */}
        <div className="sticky top-0 bg-[#fffbf0]/95 backdrop-blur-sm p-6 border-b-2 border-[#e8dcb9] flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-black text-[#5d4a36]">新增村民</h2>
            <p className="text-xs font-bold text-[#b59a7a]">建立資料後自動開始回報</p>
          </div>
          <button onClick={onCancel} className="p-2 bg-white rounded-full text-[#b59a7a] hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Avatar Selection */}
          <div className="bg-white p-5 rounded-3xl border-2 border-[#e8dcb9]">
            <label className="text-xs font-bold text-[#b59a7a] mb-3 block flex items-center gap-1"><Smile size={14}/> 選擇頭像</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {avatars.map(av => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => update({ avatar: av.id })}
                  className={`flex-shrink-0 w-12 h-12 rounded-full text-2xl flex items-center justify-center transition-all ${c.avatar === av.id ? `ring-4 ring-[#78b833] ${av.bg} scale-110` : `${av.bg} opacity-50 hover:opacity-100`}`}
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
                 className={`flex-1 py-3 rounded-xl font-black transition-all ${c.customerType === type ? 'bg-[#78b833] text-white shadow-md' : 'text-[#b59a7a] hover:bg-slate-50'}`}
               >
                 {type}
               </button>
             ))}
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            {c.customerType === '公司' && (
              <div className="animate-in slide-in-from-top-2">
                 <label className="text-xs font-bold text-[#b59a7a] ml-1 mb-1 block">公司全名</label>
                 <input className="input-nook" placeholder="例如: 帝寶管委會" value={c.companyName} onChange={e => update({ companyName: e.target.value })} />
                 <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 accent-[#78b833]" checked={c.invoiceNeeded} onChange={e => update({ invoiceNeeded: e.target.checked })} />
                    <span className="text-sm font-bold text-[#5d4a36]">需要發票</span>
                    <input className="input-nook py-1 px-3 text-sm w-40" placeholder="統編 (選填)" value={c.taxId} onChange={e => update({ taxId: e.target.value })} />
                 </div>
              </div>
            )}
            
            <div>
              <label className="text-xs font-bold text-[#b59a7a] ml-1 mb-1 block">聯絡人稱呼 <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" />
                <input 
                  required
                  className="input-nook pl-12" 
                  placeholder={c.customerType === '公司' ? "例如: 林總幹事" : "例如: 陳大哥"} 
                  value={c.contactName} 
                  onChange={e => update({ contactName: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* B. Phones */}
          <div className="bg-white p-5 rounded-3xl border-2 border-[#e8dcb9] space-y-3">
             <label className="text-xs font-bold text-[#b59a7a] block flex justify-between">
                <span>聯絡電話 <span className="text-red-400">*</span></span>
                <button type="button" onClick={addPhone} className="text-[#78b833] flex items-center gap-1 hover:underline"><Plus size={14} /> 新增備用</button>
             </label>
             {c.phones?.map((phone, idx) => (
               <div key={idx} className="flex gap-2 items-center">
                 <div className="w-20 shrink-0">
                    <input 
                      className="input-nook py-2 px-2 text-center text-xs bg-slate-50" 
                      placeholder="標籤"
                      value={phone.label}
                      onChange={e => updatePhone(idx, 'label', e.target.value)}
                    />
                 </div>
                 <div className="flex-1 relative">
                    <input 
                      required={idx === 0}
                      className="input-nook py-3 pl-3 font-mono text-lg" 
                      placeholder="電話號碼" 
                      value={phone.number} 
                      onChange={e => updatePhone(idx, 'number', e.target.value)}
                    />
                 </div>
                 {idx > 0 && (
                   <button type="button" onClick={() => removePhone(idx)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                 )}
               </div>
             ))}
          </div>

          {/* Social Accounts */}
          <div className="bg-white p-5 rounded-3xl border-2 border-[#e8dcb9] space-y-3">
             <label className="text-xs font-bold text-[#b59a7a] block flex justify-between">
                <span>社群帳號</span>
                <button type="button" onClick={addSocial} className="text-[#78b833] flex items-center gap-1 hover:underline"><Plus size={14} /> 新增帳號</button>
             </label>
             {c.socialAccounts?.map((acc, idx) => (
               <div key={idx} className="flex flex-col gap-2 p-2 border rounded-xl bg-slate-50">
                 <div className="flex gap-2">
                   <select 
                     className="bg-white border rounded px-2 py-1 text-xs font-bold"
                     value={acc.platform}
                     onChange={e => updateSocial(idx, 'platform', e.target.value)}
                   >
                     {['LINE', 'FB', 'IG', 'Threads', '官網', 'TikTok', '其他'].map(p => <option key={p}>{p}</option>)}
                   </select>
                   <input 
                     className="flex-1 bg-white border rounded px-2 py-1 text-sm"
                     placeholder="ID / 連結 / 名稱"
                     value={acc.displayName}
                     onChange={e => updateSocial(idx, 'displayName', e.target.value)}
                   />
                   <button type="button" onClick={() => removeSocial(idx)} className="text-red-300 hover:text-red-500 px-1"><Trash2 size={16}/></button>
                 </div>
                 {acc.platform === 'LINE' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">LINE 類型:</span>
                      <div className="flex gap-1 flex-1 overflow-x-auto">
                        {['官方帳號', '公司手機', '闆娘手機', '老闆手機'].map(t => (
                          <button 
                            key={t}
                            type="button" 
                            onClick={() => updateSocial(idx, 'lineChannelType', t)}
                            className={`px-2 py-0.5 rounded text-[10px] border whitespace-nowrap ${acc.lineChannelType === t ? 'bg-[#06C755] text-white border-[#06C755]' : 'bg-white text-slate-500'}`}
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
               <div className="text-center py-2 text-xs text-slate-300 italic">點擊上方新增，紀錄客人的 LINE/FB</div>
             )}
          </div>

          {/* C. Building Info */}
          <div className="bg-white p-5 rounded-3xl border-2 border-[#e8dcb9] space-y-4">
             <div>
                <label className="text-xs font-bold text-[#b59a7a] ml-1 mb-1 block">地址</label>
                <div className="relative">
                   <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" />
                   <input className="input-nook pl-12" placeholder="完整地址..." value={c.addresses?.[0]?.text} onChange={e => update({ addresses: [{ text: e.target.value, isPrimary: true }] })} />
                </div>
             </div>
             
             <div>
               <label className="text-xs font-bold text-[#b59a7a] ml-1 mb-2 block">建物類型</label>
               <div className="flex flex-wrap gap-2">
                 {Object.values(BuildingType).map(type => (
                   <button
                     key={type}
                     type="button"
                     onClick={() => update({ building_type: type })}
                     className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all ${c.building_type === type ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                   >
                     {type}
                   </button>
                 ))}
               </div>
             </div>

             {isBuildingComplex && (
               <div className="animate-in fade-in">
                 <label className="text-xs font-bold text-[#b59a7a] ml-1 mb-1 block">社區/大樓名稱</label>
                 <input className="input-nook bg-orange-50/50" placeholder="例如: 遠雄未來城" value={c.building_name} onChange={e => update({ building_name: e.target.value })} />
               </div>
             )}

             <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="elevator" className="w-5 h-5 accent-[#78b833]" checked={c.has_elevator} onChange={e => update({ has_elevator: e.target.checked })} />
                <label htmlFor="elevator" className="text-sm font-bold text-[#5d4a36]">這棟有電梯</label>
             </div>
          </div>

          {/* D. Source (Referral/Social) */}
          <div className="bg-[#f0f9ff] p-5 rounded-3xl border-2 border-blue-100 space-y-4">
             <label className="text-xs font-bold text-blue-400 ml-1 block flex items-center gap-1"><Share2 size={14} /> 客戶來源</label>
             
             <div className="flex gap-2 bg-white p-1 rounded-xl border border-blue-100">
               {['電話', '社群', '介紹', '其他'].map(src => (
                 <button
                   key={src}
                   type="button"
                   onClick={() => updateSource({ channel: src as any })}
                   className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${c.source?.channel === src ? 'bg-blue-500 text-white' : 'text-blue-300 hover:bg-blue-50'}`}
                   title={src}
                 >
                   {src}
                 </button>
               ))}
             </div>

             {/* Referral Detail */}
             {c.source?.channel === '介紹' && (
               <div className="space-y-3 bg-white p-3 rounded-xl animate-in slide-in-from-top-1 relative">
                  {c.source.referrerCustomerId ? (
                    <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                       <span className="font-bold text-green-700 flex items-center gap-2"><User size={14}/> {c.source.referrerName}</span>
                       <button type="button" onClick={() => updateSource({ referrerCustomerId: undefined, referrerName: undefined })} className="text-green-400 hover:text-green-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                          className="input-nook pl-9 py-2 text-sm" 
                          placeholder="搜尋介紹人(電話/姓名)..."
                          value={referrerSearch}
                          onChange={e => setReferrerSearch(e.target.value)}
                        />
                      </div>
                      
                      {/* Search Results */}
                      {referrerSearch && (
                        <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
                           {allCustomers.filter(cust => cust.displayName.includes(referrerSearch) || cust.phones.some(p => p.number.includes(referrerSearch))).map(match => (
                             <button key={match.customer_id} type="button" onClick={() => handleReferrerSelect(match.customer_id, match.displayName)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                               <span className="font-bold text-[#5d4a36]">{match.displayName}</span>
                               <span className="text-xs text-slate-400 ml-2">{match.phones[0]?.number}</span>
                             </button>
                           ))}
                           <button type="button" onClick={() => setShowReferrerInput(true)} className="w-full text-center py-2 text-xs font-bold text-orange-500 hover:bg-orange-50">
                             找不到？快速新增介紹人
                           </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Quick Add Referrer Modal (Inner) */}
                  {showReferrerInput && !c.source.referrerCustomerId && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
                       <p className="text-xs font-bold text-orange-700">快速建立介紹人</p>
                       <input className="w-full p-2 rounded border border-orange-200 text-sm" placeholder="姓名" value={referrerQuickName} onChange={e => setReferrerQuickName(e.target.value)} />
                       <input className="w-full p-2 rounded border border-orange-200 text-sm" placeholder="電話" value={referrerQuickPhone} onChange={e => setReferrerQuickPhone(e.target.value)} />
                       <div className="flex gap-2">
                         <button type="button" onClick={() => setShowReferrerInput(false)} className="flex-1 py-1 bg-white border rounded text-xs">取消</button>
                         <button type="button" onClick={handleQuickReferrerAdd} className="flex-1 py-1 bg-orange-400 text-white rounded text-xs font-bold">建立並綁定</button>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>

          <button type="submit" className="w-full bg-[#78b833] text-white py-4 rounded-2xl font-black text-xl shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2">
             <Save size={24} /> ✨ 完成並開始任務
          </button>

        </form>
      </div>
    </div>
  );
};

export default CustomerForm;

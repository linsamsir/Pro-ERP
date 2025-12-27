import React from 'react';
import { db } from '../services/db';
import { BuildingType, Preference, ServiceItem, JobStatus, Job, Customer } from '../types';
import { Clipboard, Loader2, ShieldCheck, Database, CheckCircle2, FileSpreadsheet, UserPlus, History, ArrowDown } from 'lucide-react';

const ImportCenter: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'new' | 'returning'>('new');
  const [pasteData, setPasteData] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [stats, setStats] = React.useState<{ success: number; skipped: number; customers: number } | null>(null);

  const formatToDateString = (dateStr: string) => {
    if (!dateStr) return new Date().toLocaleDateString('en-CA');
    try {
      const clean = dateStr.trim().split(/\s+/)[0].replace(/\//g, '-');
      const d = new Date(clean);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString('en-CA') : d.toLocaleDateString('en-CA');
    } catch {
      return new Date().toLocaleDateString('en-CA');
    }
  };

  const handleImport = async () => {
    if (!pasteData.trim()) return;
    setIsProcessing(true);
    
    // Split by newline
    const rows = pasteData.split('\n').filter(row => row.trim());
    if (rows.length < 2) {
      alert("請包含標題列！");
      setIsProcessing(false);
      return;
    }

    const headers = rows[0].split('\t').map(h => h.trim());
    const dataRows = rows.slice(1);

    let successCount = 0;
    let skippedCount = 0;
    let newCustomerCount = 0;

    const allCustomers = await db.customers.getAll();

    for (const rowText of dataRows) {
      const cols = rowText.split('\t').map(c => c.trim());
      const rowData: any = {};
      headers.forEach((h, i) => { rowData[h] = cols[i] || ''; });
      
      try {
        const name = rowData['客戶姓名'] || rowData['姓名'] || '未知客戶';
        const phone = rowData['聯絡電話'] || rowData['電話'] || '';
        const rawId = rowData['客戶編號'] || '';
        
        if (!name && !phone) {
          skippedCount++;
          continue;
        }

        // Logic difference: For 'returning', we emphasize finding existing, but fallback to create is safe
        let customer = allCustomers.find(c => 
          (rawId && c.customer_id === rawId) || 
          (phone && c.phones.some(p => p.number === phone))
        );

        let customerId = customer?.customer_id;

        if (!customer) {
          customerId = rawId || db.customers.generateId();
          const newCustomer: Customer = {
            customer_id: customerId,
            customerType: '個人',
            contactName: name,
            displayName: name,
            phones: [{ number: phone, type: '手機', isPrimary: true, label: '匯入' }],
            addresses: [{ text: rowData['客戶住址'] || rowData['地址'] || '', isPrimary: true }],
            socialAccounts: rowData['LINE ID'] ? [{ platform: 'LINE', displayName: rowData['LINE ID'] }] : [],
            preference: Preference.PHONE,
            building_type: (rowData['房屋類型'] || '').includes('大樓') ? BuildingType.BUILDING : BuildingType.DETACHED,
            has_elevator: (rowData['備註'] || '').includes('電梯'),
            is_returning: activeTab === 'returning', // Explicitly set based on tab
            ai_tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            avatar: 'man'
          };
          db.customers.save(newCustomer);
          newCustomerCount++;
        } else if (activeTab === 'returning') {
           // Update existing customer status if importing in returning mode
           customer.is_returning = true;
           db.customers.save(customer);
        }

        // Create Job Logic (Shared for now, but conceptual separation is clear in UI)
        const serviceItems: ServiceItem[] = [];
        const rawService = rowData['服務內容'] || '';
        if (rawService.includes('塔')) serviceItems.push(ServiceItem.TANK);
        if (rawService.includes('管')) serviceItems.push(ServiceItem.PIPE);
        if (serviceItems.length === 0) serviceItems.push(ServiceItem.TANK);

        const price = parseInt((rowData['金額'] || rowData['總價'] || '0').replace(/[^0-9]/g, '')) || 0;
        const tankCount = parseInt(rowData['水塔數量']) || 1;
        const isRaised = (rowData['有無架高'] || '').includes('有');
        const tankMaterial = rowData['水塔材質'] || '不鏽鋼';

        const job: Job = {
          jobId: db.jobs.generateId(),
          customerId: customerId!,
          status: JobStatus.COMPLETED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contactPerson: name,
          contactPhone: phone,
          
          // Pipe Details - New Defaults
          pipeBeforeStatus: '保養',
          pipeAfterStatus: '改善明顯',
          
          waterSourceTypes: ['自來水'],
          hasBoosterPump: '不確定',
          groundPumpOk: '不確定',
          waterSelfToTank: '不確定',
          waterHeaterType: '不確定',
          serviceItems: serviceItems,
          tankConfigs: [{
            id: `T${Date.now()}`,
            location: '頂樓戶外', 
            material: tankMaterial as any, 
            orientation: '直式',
            tonnage: '1', 
            count: tankCount, 
            isRaised: isRaised, 
            hasMotor: false
          }],
          tankConditionTags: [],
          bathroomCount: 1, kitchenCount: 1,
          pipeResultTags: ['保養', '出水明顯改善'],
          subjective_tags: [],
          bookingDate: formatToDateString(rowData['預約日期'] || rowData['時間戳記']),
          bookingSlot: (rowData['預約時段'] || '早') as any,
          serviceDate: formatToDateString(rowData['施工日期'] || rowData['日期'] || rowData['時間戳記']),
          
          // Time & Travel - New Defaults
          arrival_time: '09:30',
          arrivalTimePreset: '09:30',
          
          workDurationHours: parseFloat(rowData['工時']) || 2,
          travelMode: '單程',
          travelBaseMinutes: 30,
          travelMinutesCalculated: 30,
          
          // Consumables - New Structure
          consumables: {
            citric_acid: 1,
            chemical: 0
          },
          citricAcidCans: 1, otherChemicalCans: 0,
          
          // Financials - New Structure
          financial: {
            total_amount: price,
            payment_method: '現金',
            invoice_issued: (rowData['是否收費'] || '').includes('是'),
            extra_items: []
          },
          totalPaid: price, paymentMethod: '現金',
          invoiceNeeded: (rowData['是否收費'] || '').includes('是'),
          
          hasExtraCharge: false, extraChargeAmount: 0, extraChargeNote: '',
          // leadChannel: '其他', // Removed as it is not in Job interface
          serviceNote: rowData['備註'] || ''
        };
        // If returning mode, we might want to check if this specific job date is older/newer, 
        // but for now we just append history.
        
        await db.jobs.save(job, { skipAi: true });
        successCount++;
      } catch (err) {
        console.error(err);
        skippedCount++;
      }
    }

    setStats({ success: successCount, skipped: skippedCount, customers: newCustomerCount });
    setIsProcessing(false);
    setPasteData('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pop pb-20">
      <header>
        <h2 className="text-4xl font-black text-[#5d4a36]">移居服務中心</h2>
        <p className="text-[#b59a7a] mt-2 font-bold flex items-center gap-2">
          協助處理大量村民資料的遷入作業
        </p>
      </header>

      {/* Type Toggle Tabs */}
      <div className="flex bg-[#e8dcb9] p-2 rounded-3xl gap-2">
        <button 
          onClick={() => { setActiveTab('new'); setStats(null); }}
          className={`flex-1 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'new' ? 'bg-white text-[#5d4a36] shadow-md' : 'text-[#7c6046] hover:bg-white/50'}`}
        >
          <UserPlus size={20} /> 新客移居辦理
        </button>
        <button 
          onClick={() => { setActiveTab('returning'); setStats(null); }}
          className={`flex-1 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'returning' ? 'bg-[#78b833] text-white shadow-md' : 'text-[#7c6046] hover:bg-white/50'}`}
        >
          <History size={20} /> 老朋友回歸登記
        </button>
      </div>

      <div className="ac-card p-8 bg-white">
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-[#5d4a36] font-black">
            <div className="bg-[#fdfaf0] border-2 border-[#eeeada] p-3 rounded-xl text-[#b59a7a]">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="text-lg">貼上 Excel 資料</div>
              <div className="text-xs text-[#b59a7a] font-bold">
                 {activeTab === 'new' ? '適用：完全沒有來過的全新客戶資料' : '適用：系統已有資料，需補登新的服務紀錄'}
              </div>
            </div>
          </div>
          
          <div className="bg-[#f0f9ff] p-4 rounded-xl border border-blue-100 text-xs font-mono text-blue-800 overflow-x-auto whitespace-nowrap">
            <span className="font-bold text-blue-400 select-none mr-2">建議欄位順序:</span>
            {activeTab === 'new' 
              ? `時間戳記 | 客戶姓名 | 電話 | 住址 | 房屋類型 | 預約日期 | 金額 | 備註`
              : `時間戳記 | 客戶編號(選填) | 姓名 | 電話 | 上次清洗日 | 備註`
            }
          </div>

          <div className="relative group">
            <textarea
              className="w-full h-64 input-nook font-mono resize-none text-sm leading-relaxed"
              placeholder={activeTab === 'new' 
                ? "請在此貼上新客戶的 Google Sheet 資料..." 
                : "請在此貼上回流客的工單資料..."}
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
            />
            {pasteData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <ArrowDown size={48} className="text-[#b59a7a] animate-bounce" />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={!pasteData.trim() || isProcessing}
              className="bg-[#78b833] text-white px-8 py-4 rounded-2xl font-black text-xl shadow-[0_4px_0_#4a7a1f] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Database />}
              {activeTab === 'new' ? '開始辦理移居' : '更新歷史紀錄'}
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="ac-card p-8 bg-[#f0fdf4] border-green-200 animate-pop">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 size={32} /></div>
            <div>
               <h3 className="text-xl font-black text-[#15803d]">辦理完成！</h3>
               <p className="text-xs font-bold text-green-600">村莊人口已更新</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl text-center shadow-sm">
              <div className="text-xs font-black text-[#b59a7a] uppercase mb-1">新增村民</div>
              <div className="text-3xl font-black text-[#5d4a36]">{stats.customers}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl text-center shadow-sm">
              <div className="text-xs font-black text-[#b59a7a] uppercase mb-1">建立任務</div>
              <div className="text-3xl font-black text-[#5d4a36]">{stats.success}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl text-center shadow-sm border-2 border-orange-100">
              <div className="text-xs font-black text-orange-400 uppercase mb-1">格式錯誤</div>
              <div className="text-3xl font-black text-orange-400">{stats.skipped}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportCenter;
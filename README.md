
# Schema v1.2 Upgrade Documentation

## 1. Data Schema Compliance (Full Implementation)
The system strictly follows the Schema v1.2 definition:
- **Customer**: Master profile with recurring service tracking and AI-generated tags.
- **Order**: Appointment and quotation management.
- **ServiceReport**: On-site execution records including SOP checklists and travel time calculation.

## 2. Google Sheet → Schema v1.2 Mapping Table

| 舊 Sheet 欄位 (範例) | 新 Schema 欄位 | 所屬資料表 | 處理規則 |
| :--- | :--- | :--- | :--- |
| 客戶姓名 / 稱呼 | 客戶稱呼 | Customer | 直接對應 |
| 主要電話 | 主要聯絡電話 | Customer | 直接對應 |
| 第二聯絡方式 | 其他聯絡電話清單 | Customer | 轉換為陣列 |
| 地址 | 主要地址 | Customer | 完整字串存入 |
| 房屋類型 | 住宅／場所類型 | Customer | 列舉對應 |
| 有無電梯 | 是否有電梯 | Customer | 直接對應 |
| LINE ID | 社群帳號 ID | Customer | 類型設為 LINE |
| 預約日期 | 預約日期 | Order | 僅存日期 |
| 預約時段 (09:00等) | 預約時段 | Order | 轉換為 早/午/晚 |
| 服務內容 | 服務項目 | Order | 多選陣列 |
| 價格 | 報價金額 | Order | 數值對應 |
| 是否收費 | 付款狀態 | Order | 已收/未收 |
| 施工日期 | 施工日期 | ServiceReport | 直接對應 |
| 到達時間 | 抵達時間 | ServiceReport | 固定選項 (09:30/13:30/其他) |
| 工時 | 施工工時 | ServiceReport | 僅存數值 |
| 備註 / 雜項 | 原始備註原文 | 各資料表 | 合併存入各層備註 |
| *無法辨識之欄位* | 暫存欄位 (temp_fields) | 各資料表 | 以 JSON 字串存於對應層 |

## 3. Database Design & Indexing
### Table: Customer
- **PK**: `customer_id` (C0000001)
- **Index**: `primary_phone` (Unique-ish), `customer_id`

### Table: Order
- **PK**: `order_id` (System UUID)
- **FK**: `customer_id`
- **Index**: `appointment_date`, `status`, `customer_id`

### Table: ServiceReport
- **PK**: `report_id` (System UUID)
- **FK**: `order_id`, `customer_id`
- **Index**: `order_id`, `service_date`

## 4. Business Logic Implementation
- **Travel Time**: `totalTravelTime = singleWayMin * (type === 'round' ? 2 : 1)`.
- **AI Tagging**: Automated via Gemini API using `customer_notes`.
- **Flow Back**: Updating `is_returning`, `last_service_date`, `last_service_item` in Customer master upon ServiceReport completion.

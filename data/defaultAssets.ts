
import { L2Asset } from "../types";

export const DEFAULT_ASSETS: Partial<L2Asset>[] = [
  // 電動核心工具
  { name: "高壓清洗機", category: "電動核心工具", note: "建議 110V 型號，新手易於取得電源", qty: 1, unit: "台" },
  { name: "沉水泵浦", category: "電動核心工具", note: "用於快速排水與擋水", qty: 1, unit: "台" },
  { name: "乾濕兩用吸塵器", category: "電動核心工具", note: "清除頑固青苔、泥沙與殘水", qty: 1, unit: "台" },
  { name: "工業延長線", category: "電動核心工具", note: "建議使用 3 芯電線，線徑 1.6mm 以上，確保安全", qty: 1, unit: "捲" },
  { name: "工作照明燈", category: "電動核心工具", note: "用於光線不足的地下室或陰暗處", qty: 1, unit: "盞" },

  // 手動輔助工具
  { name: "長柄伸縮工具刷", category: "手動輔助工具", note: "清洗水塔內壁", qty: 2, unit: "支" },
  { name: "各式手工具", category: "手動輔助工具", note: "一字/十字起子、老虎鉗、鯉魚鉗、活動板手", qty: 1, unit: "組" },
  { name: "橡膠槌", category: "手動輔助工具", note: "物理性震落重度水垢", qty: 1, unit: "支" },
  { name: "TOTO 起泡器拆卸工具", category: "手動輔助工具", note: "拆卸特殊規格的水龍頭起泡頭", qty: 1, unit: "個" },

  // 清潔與附加設備
  { name: "摺疊泡澡桶", category: "清潔與附加設備", note: "折疊後易攜帶，特別適合頂樓作業使用", qty: 1, unit: "個" },
  { name: "除塵抹布、塑膠水勺", category: "清潔與附加設備", note: "細節清潔", qty: 1, unit: "組" },

  // 安全防護裝備
  { name: "安全帽", category: "安全防護裝備", note: "保護頭部", qty: 2, unit: "頂" },
  { name: "護目鏡/太陽眼鏡", category: "安全防護裝備", note: "保護眼睛", qty: 2, unit: "副" },
  { name: "活性碳口罩", category: "安全防護裝備", note: "過濾粉塵與異味", qty: 1, unit: "盒" },
  { name: "止滑/防化學手套", category: "安全防護裝備", note: "保護手部", qty: 1, unit: "雙" },
  { name: "防滑工作鞋/雨鞋", category: "安全防護裝備", note: "避免滑倒", qty: 2, unit: "雙" },
  { name: "背負式安全帶 & 安全繩", category: "安全防護裝備", note: "高處作業必備", qty: 1, unit: "組" },

  // 清潔劑與耗材
  { name: "食品級檸檬酸", category: "清潔劑與耗材", note: "安全、環保，適用多數情況", qty: 1, unit: "袋" },
  { name: "工業用/水塔專用除垢劑", category: "清潔劑與耗材", note: "針對重度水垢、鏽斑使用", qty: 1, unit: "桶" },
  { name: "止洩帶/電火布", category: "清潔劑與耗材", note: "用於臨時應急，不屬於永久維修材料", qty: 1, unit: "組" },
  { name: "備用橡膠墊片", category: "清潔劑與耗材", note: "用於更換老化的水管接頭墊片", qty: 1, unit: "包" }
];

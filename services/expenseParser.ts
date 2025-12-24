
import { Expense } from '../types';

export interface ParsedExpensePreview {
  date: string; // YYYY-MM-DD
  category: Expense['category'];
  categoryLabel: string; // Display Name (中文)
  amount: number;
  note: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
  warning?: string;
}

export const parseExpenseInput = (text: string): ParsedExpensePreview[] => {
  if (!text) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. Normalize Text
  // Replace full-width characters and spaces
  const normalized = text.replace(/，/g, ',').replace(/：/g, ':').replace(/\s+/g, ' ').trim();
  
  // 2. Extract Date
  let dateStr = new Date().toLocaleDateString('en-CA'); // Default today
  let dateMatched = false;

  // Pattern: "這個月15號", "15號" (Assume current month)
  const dayMatch = normalized.match(/(?:這個月|本月)?(\d{1,2})[號日]/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]);
    const d = new Date(currentYear, currentMonth - 1, day);
    // Handle invalid date overflow simply by clamp logic or let JS date handle it (it rolls over)
    dateStr = d.toLocaleDateString('en-CA');
    dateMatched = true;
  }

  // Pattern: Relative days
  if (normalized.includes('昨天')) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    dateStr = d.toLocaleDateString('en-CA');
    dateMatched = true;
  } else if (normalized.includes('前天')) {
    const d = new Date(); d.setDate(d.getDate() - 2);
    dateStr = d.toLocaleDateString('en-CA');
    dateMatched = true;
  }

  // Pattern: Standard Dates (2025/12/15, 12/15, 12-15)
  const stdDateMatch = normalized.match(/(\d{4})?[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (stdDateMatch) {
    const y = stdDateMatch[1] ? parseInt(stdDateMatch[1]) : currentYear;
    const m = parseInt(stdDateMatch[2]);
    const d = parseInt(stdDateMatch[3]);
    dateStr = new Date(y, m - 1, d).toLocaleDateString('en-CA');
    dateMatched = true;
  }

  // 3. Extract Category
  let category: Expense['category'] = 'other';
  let categoryLabel = '其他雜支';
  
  if (/勞保|健保|保險/.test(normalized)) { category = 'insurance'; categoryLabel = '勞健保'; }
  else if (/水電|電費|水費/.test(normalized)) { category = 'utilities'; categoryLabel = '公司水電'; }
  else if (/電話|網路|中華電信|遠傳|台哥大/.test(normalized)) { category = 'phone'; categoryLabel = '電話網路'; }
  else if (/油|加油|中油|台塑/.test(normalized)) { category = 'fuel'; categoryLabel = '油資'; }
  else if (/檸檬酸|藥劑|清潔劑|材料|耗材/.test(normalized)) { category = 'other'; categoryLabel = '耗材購入'; } // Currently map to 'other' but label it

  // 4. Extract Amounts
  // Look for numbers that look like currency (not part of date)
  // Strategy: remove the matched date part first to avoid confusion? 
  // For V1, we just look for numbers > 31 or explicitly distinct from date patterns.
  // Or simple splitting by '+' if present.
  
  const numbers = normalized.match(/(\d{2,})/g)?.map(n => parseInt(n)) || [];
  // Filter out potential date numbers (like 2025, 12, 15 if they were matched)
  // This is tricky. Let's use a simpler heuristic:
  // If text contains "+", we assume split mode.
  
  const results: ParsedExpensePreview[] = [];
  const isSplit = normalized.includes('+') && numbers.length > 1;

  if (isSplit) {
    // Attempt to pair text with numbers or just list numbers
    numbers.forEach(num => {
      // Ignore numbers that are likely years (2024, 2025) if they appear at start? 
      // Safe guard: only treat as amount if reasonable cost.
      if (num === currentYear || num === currentYear + 1) return; 

      results.push({
        date: dateStr,
        category,
        categoryLabel,
        amount: num,
        note: normalized, // Keep full original text as note
        confidence: dateMatched ? 'HIGH' : 'MED'
      });
    });
  } else {
    // Single Amount Logic
    // Find the largest number that isn't the year
    const validNumbers = numbers.filter(n => n !== currentYear && n !== 2023 && n !== 2024 && n !== 2025 && n !== 2026);
    const amount = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
    
    results.push({
      date: dateStr,
      category,
      categoryLabel,
      amount,
      note: normalized,
      confidence: (amount > 0 && dateMatched) ? 'HIGH' : (amount > 0 ? 'MED' : 'LOW'),
      warning: amount === 0 ? '沒找到金額' : !dateMatched ? '日期預設為今天' : undefined
    });
  }

  return results;
};

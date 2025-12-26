
import { GoogleGenAI, Type } from "@google/genai";

let lastQuotaExceededTimestamp = 0;
const QUOTA_COOLDOWN_MS = 60000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to robustly find the API Key in various environments (Vite, CRA, Node)
const getApiKey = (): string => {
  // 1. Try Vite standard (import.meta.env.VITE_API_KEY)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {}

  // 2. Try Node/CRA/Process standard
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      // @ts-ignore
      if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY;
      // @ts-ignore
      if (process.env.API_KEY) return process.env.API_KEY;
    }
  } catch (e) {}

  // 3. Fallback to global window (from index.html polyfill)
  try {
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
      return (window as any).process.env.API_KEY;
    }
  } catch (e) {}

  return '';
};

export const getAiCooldownSeconds = (): number => {
  const now = Date.now();
  const diff = now - lastQuotaExceededTimestamp;
  if (diff < QUOTA_COOLDOWN_MS) {
    return Math.ceil((QUOTA_COOLDOWN_MS - diff) / 1000);
  }
  return 0;
};

export const checkApiHealth = async (): Promise<{ status: 'ok' | 'quota_low' | 'error', message: string }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { status: 'error', message: '未偵測到 API 金鑰。請在 Vercel 設定 VITE_API_KEY。' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "ping",
      config: {
        maxOutputTokens: 5,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    if (response.text) {
      return { status: 'ok', message: '連線正常，AI 引擎待命中心！' };
    }
    return { status: 'error', message: '收到空回應，請檢查金鑰。' };
  } catch (error: any) {
    const status = error?.status || 0;
    const msg = error?.message || '';

    if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      lastQuotaExceededTimestamp = Date.now();
      return { status: 'quota_low', message: '額度已達上限 (429)。請稍候 1 分鐘，或切換至付費金鑰。' };
    }
    
    if (status === 403 || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
      return { status: 'error', message: 'API 金鑰無效或已過期。' };
    }

    return { status: 'error', message: `診斷失敗: ${msg}` };
  }
};

export const extractAiTags = async (notes: string, maxRetries = 1): Promise<string[]> => {
  if (!notes.trim()) return [];

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("AI Tagging skipped: No API Key");
    return [];
  }

  const cooldown = getAiCooldownSeconds();
  if (cooldown > 0) {
    throw new Error(`AI 額度冷卻中，請於 ${cooldown} 秒後再試。`);
  }
  
  let retryCount = 0;
  
  const runExtraction = async (): Promise<string[]> => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `你是一個專業的水塔清洗系統助理。請從以下文字擷取 3-5 個繁體中文關鍵標籤（例如：#頂樓外推 #水壓偏低 #長期客戶）：\n\n"${notes}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      
      const text = response.text?.trim();
      return text ? JSON.parse(text) : [];
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      const isQuotaError = 
        error?.status === 429 ||
        error?.message?.includes('429') || 
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuotaError) {
        lastQuotaExceededTimestamp = Date.now();
        if (retryCount < maxRetries) {
          retryCount++;
          await sleep(2000);
          return runExtraction();
        }
        throw new Error('目前已達每分鐘呼叫上限。如果您有大量需求，建議點擊「選取付費金鑰」。');
      }

      throw new Error(error?.message || 'AI 分析連線異常。');
    }
  };

  return await runExtraction();
};

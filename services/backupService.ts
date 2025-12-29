
import { db } from './db';

// Configuration Retrieval Helper
const getEnv = (key: string): string => {
  // 1. Try Vite import.meta.env
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // 2. Try window.process (Polyfill in index.html)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env[key]) {
    // @ts-ignore
    return window.process.env[key];
  }
  // 3. Try global process (Node/Build)
  try {
    if (process.env[key]) return process.env[key]!;
  } catch (e) {}

  return '';
};

const BACKUP_API_URL = getEnv('VITE_BACKUP_WEBAPP_URL'); 
const BACKUP_TOKEN = getEnv('VITE_BACKUP_TOKEN') || 'default-token';
const CHUNK_SIZE = 50; 

export type BackupStatus = 'IDLE' | 'FETCHING' | 'UPLOADING' | 'COMPLETED' | 'ERROR';

export interface BackupLog {
  collection: string;
  status: BackupStatus;
  progress: number; 
  totalDocs: number;
  message?: string;
}

const flattenObject = (obj: any): Record<string, any> => {
  const result: Record<string, any> = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value === null || value === undefined) {
      result[key] = '';
    } else if (typeof value === 'object') {
      if (value.seconds !== undefined && value.nanoseconds !== undefined) {
        // Handle Firestore Timestamp
        result[key] = new Date(value.seconds * 1000).toISOString();
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else {
        // Stringify nested objects (arrays, objects)
        result[key] = JSON.stringify(value);
      }
    } else {
      result[key] = value;
    }
  });
  
  return result;
};

// Helper: Sleep function for backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const BackupService = {
  checkConfig: () => {
    // Re-check at runtime
    const url = getEnv('VITE_BACKUP_WEBAPP_URL');
    if (!url) throw new Error("尚未設定 VITE_BACKUP_WEBAPP_URL");
    if (!url.startsWith('https://script.google.com')) throw new Error("無效的 Google Script 網址");
    if (!BACKUP_TOKEN) throw new Error("尚未設定 VITE_BACKUP_TOKEN");
    return url;
  },

  fetchAllData: async () => {
    // Parallel Fetch
    const [customers, jobs, expenses, assets, stock] = await Promise.all([
      db.customers.getAll(),
      db.jobs.getAll(),
      db.expenses.getAll(),
      db.l2.assets.getAll(),
      db.l2.stock.getAll()
    ]);

    return {
      customers,
      jobs,
      expenses,
      assets,
      stock
    };
  },

  uploadChunk: async (collectionName: string, data: any[], isFirstChunk: boolean, retryCount = 0): Promise<any> => {
    const baseUrl = BackupService.checkConfig();
    const MAX_RETRIES = 3;
    
    // Append timestamp to avoid caching issues
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    const payload = {
      collection: collectionName,
      data: data.map(flattenObject), // Serialize for Sheet
      isFirstChunk,
      token: BACKUP_TOKEN
    };

    try {
      // GAS requires following redirects (302) to get the actual response
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Prevent CORS preflight
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Backup Raw Response:", text);
        // If we get HTML back (often Google login page or error page), throw specific error
        if (text.includes('<!DOCTYPE html>')) {
             throw new Error("收到 HTML 回應而非 JSON。這通常代表：\n1. Google Script 權限未設為 'Anyone'\n2. 瀏覽器擋住了重新導向");
        }
        throw new Error(`Google Script 回傳了無效的格式: ${text.substring(0, 50)}...`);
      }

      if (result.status !== 'success') {
        throw new Error(result.message || 'Unknown GAS Error');
      }
      return result;

    } catch (error: any) {
        console.error(`Upload Chunk Failed (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
        
        // Retry Logic for Network Errors
        if (retryCount < MAX_RETRIES) {
            const delay = 2000 * Math.pow(2, retryCount); 
            console.log(`Retrying in ${delay}ms...`);
            await sleep(delay);
            return BackupService.uploadChunk(collectionName, data, isFirstChunk, retryCount + 1);
        }

        if (error.message.includes('Failed to fetch')) {
            throw new Error(
                "連線失敗 (Failed to fetch)。\n" +
                "請依序檢查：\n" +
                "1. Google Script 部署權限是否設為「Anyone (任何人)」(最常見原因)\n" +
                "2. 您的瀏覽器是否安裝了阻擋廣告或 CORS 的擴充功能\n" +
                "3. 嘗試使用無痕模式 (Incognito) 測試"
            );
        }
        throw error;
    }
  },

  runBackup: async (
    onProgress: (log: BackupLog) => void
  ) => {
    BackupService.checkConfig();

    try {
      // 1. Fetch All
      onProgress({ collection: 'SYSTEM', status: 'FETCHING', progress: 0, totalDocs: 0, message: '正在讀取 Firestore...' });
      const allData = await BackupService.fetchAllData();
      
      const tasks = [
        { name: 'customers', data: allData.customers },
        { name: 'jobs', data: allData.jobs },
        { name: 'expenses', data: allData.expenses },
        { name: 'assets', data: allData.assets },
        { name: 'stock', data: allData.stock }
      ];

      // 2. Upload Each Collection
      for (const task of tasks) {
        const total = task.data.length;
        
        // Handle Empty Collection
        if (total === 0) {
            await BackupService.uploadChunk(task.name, [], true);
            onProgress({ collection: task.name, status: 'COMPLETED', progress: 100, totalDocs: 0, message: '無資料，已清空表格' });
            continue;
        }

        onProgress({ collection: task.name, status: 'UPLOADING', progress: 0, totalDocs: total });

        // Chunking
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = task.data.slice(i, i + CHUNK_SIZE);
          const isFirst = i === 0;
          
          await BackupService.uploadChunk(task.name, chunk, isFirst);
          
          const progress = Math.round(((i + chunk.length) / total) * 100);
          onProgress({ 
            collection: task.name, 
            status: 'UPLOADING', 
            progress, 
            totalDocs: total,
            message: `已上傳 ${Math.min(i + chunk.length, total)} / ${total} 筆`
          });
        }

        onProgress({ collection: task.name, status: 'COMPLETED', progress: 100, totalDocs: total, message: '同步完成' });
      }

    } catch (error: any) {
      console.error("Backup Failed", error);
      throw error;
    }
  }
};

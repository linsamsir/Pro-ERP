
import { db } from './db';

// Helper: Get Environment Variable at Runtime
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
  return '';
};

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
  checkConfig: (): { url: string, token: string } => {
    // Read at runtime to ensure env is ready
    const url = getEnv('VITE_BACKUP_WEBAPP_URL');
    const token = getEnv('VITE_BACKUP_TOKEN');

    if (!url) throw new Error("尚未設定 VITE_BACKUP_WEBAPP_URL");
    if (!url.startsWith('https://script.google.com')) throw new Error("無效的 Google Script 網址");
    
    // Strict Token Check - No fallback
    if (!token) throw new Error("尚未設定 VITE_BACKUP_TOKEN (請檢查 index.html 設定)");
    
    return { url, token };
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
    const { url: baseUrl, token } = BackupService.checkConfig();
    const MAX_RETRIES = 3;
    
    // Append timestamp to avoid caching issues
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    const payload = {
      collection: collectionName,
      data: data.map(flattenObject), // Serialize for Sheet
      isFirstChunk,
      token: token // Send the configured token
    };

    try {
      if (retryCount === 0) {
         // console.log(`[Backup] Sending ${collectionName} chunk...`);
      }

      // ⭐ CRITICAL CONFIGURATION for "Anyone" Access:
      // 1. mode: 'cors' (Default) allows us to read response status/text.
      // 2. credentials: 'omit' is ESSENTIAL to prevent Google sending cookies which triggers 302 login redirects.
      // 3. redirect: 'follow' allows following the GAS 302 redirect to the actual content result.
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit', 
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[Backup Error] Status: ${response.status}`, text.substring(0, 200));

        if (response.status === 401) {
            throw new Error(`Unauthorized (401)：VITE_BACKUP_TOKEN (${token.substring(0,3)}***) 與 GAS 端不一致。`);
        }
        
        // Google often returns HTML for 404/403/NeedPermission pages
        if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('Google Accounts')) {
            throw new Error("收到 HTML 回應，多半是部署權限/導向問題。\n請確認 Script 部署為「任何人 (Anyone)」");
        }

        throw new Error(`上傳失敗 (${response.status}): ${text.substring(0, 100)}`);
      }

      // Success Logging
      console.log(`[Backup] Success: ${collectionName} chunk (${data.length} items, first:${isFirstChunk}). Token: ${token.substring(0,4)}***`);
      
      return { status: 'success' };

    } catch (error: any) {
        console.error(`Upload Chunk Failed (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
        
        // Handle "Failed to fetch" which is often a hidden 401/CORS error from Google if config is slightly off
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
             if (retryCount >= MAX_RETRIES) {
                 throw new Error("無法連線 (Failed to fetch)。\n請確認：\n1. 部署權限是否為「任何人 (Anyone)」\n2. 網址是否正確\n3. 網路連線正常");
             }
        }

        // Retry Logic only for network/fetch errors, not logic errors
        if (retryCount < MAX_RETRIES && !error.message.includes('Unauthorized') && !error.message.includes('HTML')) {
            const delay = 2000 * Math.pow(2, retryCount); 
            console.log(`Retrying in ${delay}ms...`);
            await sleep(delay);
            return BackupService.uploadChunk(collectionName, data, isFirstChunk, retryCount + 1);
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
          
          // Add small delay to prevent overwhelming GAS concurrent limits
          await sleep(500); 
          
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
      console.error("Backup Failed Stop", error);
      // Ensure the error propagates to UI and stops the loop
      throw error;
    }
  }
};

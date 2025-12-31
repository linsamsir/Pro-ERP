
import { db } from './db';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env[key]) {
    return (window as any).process.env[key];
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

/**
 * 深度脫敏物件，確保沒有循環引用與複雜的 SDK 內部物件
 */
const prepareForBackup = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return obj;

  if (seen.has(obj)) return '[Circular]';
  
  // 檢查是否為 Firebase SDK 內部類別
  if (
    obj.constructor?.name?.startsWith('Q') || 
    obj.constructor?.name === 'Sa' ||
    obj._database || obj.firestore || obj._path
  ) {
    return `[Ref:${obj.path || 'internal'}]`;
  }

  // Firestore Timestamp
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }
  
  // Date
  if (obj instanceof Date) return obj.toISOString();

  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => prepareForBackup(item, seen));
  }

  const result: Record<string, any> = {};
  try {
    Object.keys(obj).forEach(key => {
      if (key.startsWith('_')) return; // 跳過私有成員
      const val = obj[key];
      // 遞迴清理，但不進行 stringify，交由最後 fetch 時的 body 處理
      result[key] = prepareForBackup(val, seen);
    });
  } catch (e) {
    return '[Complex Data]';
  }
  return result;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const BackupService = {
  checkConfig: (): { url: string, token: string } => {
    const url = getEnv('VITE_BACKUP_WEBAPP_URL');
    const token = getEnv('VITE_BACKUP_TOKEN');
    if (!url) throw new Error("尚未設定 VITE_BACKUP_WEBAPP_URL");
    if (!url.startsWith('https://script.google.com')) throw new Error("無效的 Google Script 網址");
    if (!token) throw new Error("尚未設定 VITE_BACKUP_TOKEN");
    return { url, token };
  },

  fetchAllData: async () => {
    const [customers, jobs, expenses, assets, stock] = await Promise.all([
      db.customers.getAll(),
      db.jobs.getAll(),
      db.expenses.getAll(),
      db.l2.assets.getAll(),
      db.l2.stock.getAll()
    ]);
    return { customers, jobs, expenses, assets, stock };
  },

  uploadChunk: async (collectionName: string, data: any[], isFirstChunk: boolean, retryCount = 0): Promise<any> => {
    const { url: baseUrl, token } = BackupService.checkConfig();
    const MAX_RETRIES = 3;
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    // 清理 Data
    const sanitizedData = data.map(item => prepareForBackup(item, new WeakSet()));
    
    const payload = {
      collection: collectionName,
      data: sanitizedData,
      isFirstChunk,
      token: token
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit', 
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload) // 這裡的序列化現在是安全的
      });
      if (!response.ok) {
        const text = await response.text();
        if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('Google Accounts')) {
            throw new Error("收到 HTML 回應，請確認 Script 部署為「任何人 (Anyone)」");
        }
        throw new Error(`上傳失敗 (${response.status}): ${text.substring(0, 100)}`);
      }
      return { status: 'success' };
    } catch (error: any) {
        if (retryCount < MAX_RETRIES && !error.message.includes('Unauthorized') && !error.message.includes('HTML')) {
            await sleep(2000 * Math.pow(2, retryCount));
            return BackupService.uploadChunk(collectionName, data, isFirstChunk, retryCount + 1);
        }
        throw error;
    }
  },

  runBackup: async (onProgress: (log: BackupLog) => void) => {
    try {
      onProgress({ collection: 'SYSTEM', status: 'FETCHING', progress: 0, totalDocs: 0, message: '正在讀取 Firestore...' });
      const allData = await BackupService.fetchAllData();
      const tasks = [
        { name: 'customers', data: allData.customers },
        { name: 'jobs', data: allData.jobs },
        { name: 'expenses', data: allData.expenses },
        { name: 'assets', data: allData.assets },
        { name: 'stock', data: allData.stock }
      ];
      for (const task of tasks) {
        const total = task.data.length;
        if (total === 0) {
            await BackupService.uploadChunk(task.name, [], true);
            onProgress({ collection: task.name, status: 'COMPLETED', progress: 100, totalDocs: 0, message: '無資料' });
            continue;
        }
        onProgress({ collection: task.name, status: 'UPLOADING', progress: 0, totalDocs: total });
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = task.data.slice(i, i + CHUNK_SIZE);
          await BackupService.uploadChunk(task.name, chunk, i === 0);
          await sleep(500); 
          onProgress({ collection: task.name, status: 'UPLOADING', progress: Math.round(((i + chunk.length) / total) * 100), totalDocs: total });
        }
        onProgress({ collection: task.name, status: 'COMPLETED', progress: 100, totalDocs: total, message: '同步完成' });
      }
    } catch (error: any) {
      throw error;
    }
  }
};

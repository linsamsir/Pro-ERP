
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { User, AuditLog } from "../types";

const COLLECTION = "audit_logs";

export interface AuditEntry {
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE';
  module: 'AUTH' | 'CUSTOMER' | 'JOB' | 'EXPENSE' | 'SETTINGS' | 'SYSTEM';
  entityId?: string;
  entityName?: string;
  summary: string;
  before?: any;
  after?: any;
}

/**
 * 徹底清理物件中的循環參照與 Firebase 內部複雜物件
 */
const sanitize = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // 處理循環參照
  if (seen.has(obj)) return '[Circular]';
  
  // 處理 Date 與 Firestore Timestamp
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }
  if (obj instanceof Date) return obj.toISOString();
  
  // 處理陣列
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, seen));
  }

  // 偵測並攔截 Firebase SDK 內部物件 (Q$1, Sa, src 等混淆後的類別)
  // 這些物件通常包含大量的內部引用，絕對不能序列化
  if (
    obj.constructor?.name?.startsWith('Q') || 
    obj.constructor?.name === 'Sa' ||
    obj._database || obj.firestore || obj._path || obj.converter
  ) {
    return `[FirebaseInternal:${obj.path || 'Ref'}]`;
  }

  seen.add(obj);

  const cleanObj: any = {};
  try {
    const keys = Object.keys(obj);
    for (const key of keys) {
      // 過濾隱藏屬性
      if (key.startsWith('_') || key.startsWith('__')) continue;
      
      const value = obj[key];
      // 遞迴清理
      cleanObj[key] = sanitize(value, seen);
    }
  } catch (e) {
    return '[Complex/Native Object]';
  }
  return cleanObj;
};

export const AuditService = {
  /**
   * 寫入審計日誌。
   * 使用非阻塞模式，即使日誌寫入失敗（如權限不足）也不應影響主程式。
   */
  log: async (entry: AuditEntry, actor: User | null) => {
    try {
      const actorData = actor ? {
        uid: actor.id,
        name: actor.name,
        role: actor.role,
        account: actor.username
      } : {
        uid: 'system',
        name: 'System',
        role: 'SYSTEM',
        account: 'system'
      };

      let diff = null;
      if (entry.before || entry.after) {
        diff = {
          // 在序列化前先進行強力的深度清理
          before: entry.before ? sanitize(entry.before) : null,
          after: entry.after ? sanitize(entry.after) : null
        };
      }

      const logData = {
        ts: serverTimestamp(),
        actor: actorData,
        module: entry.module,
        action: entry.action,
        target: {
          entityType: entry.module,
          entityId: entry.entityId || 'N/A',
          entityName: entry.entityName || ''
        },
        summary: entry.summary,
        diff: diff,
        createdAt: new Date().toISOString()
      };

      // 背景執行，不 await
      addDoc(collection(db, COLLECTION), logData).catch(err => {
        console.warn("[Audit] 寫入背景日誌失敗 (權限或連線問題):", err.message);
      });
      
    } catch (error) {
      console.error("[Audit] 準備日誌資料時發生錯誤 (可能仍有循環引用):", error);
    }
  }
};

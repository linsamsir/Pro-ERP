
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
 * Robust sanitizer that strips circular references and Firebase internal objects.
 * Uses property detection to survive minification.
 */
const sanitize = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // 1. Handle Circularity
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  
  // 2. Handle Firestore Timestamps
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }
  
  // 3. Handle Dates
  if (obj instanceof Date) return obj.toISOString();

  // 4. Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, seen));
  }

  // 5. Handle Firebase/Firestore SDK Internals (Refs, Instances, etc)
  // These usually have a 'firestore' or 'type' property and lots of internal state.
  // We look for common patterns to avoid serializing them.
  if (
    (obj.firestore && obj.path) || // DocumentReference/CollectionReference
    (obj.type === 'document' || obj.type === 'collection' || obj.type === 'query') ||
    (obj.constructor && /Firestore|Reference|Query|Snapshot/.test(obj.constructor.name)) ||
    (obj._database || obj._path || obj._firestore) // Common internal markers
  ) {
    return `Ref(${obj.path || 'firebase_internal'})`;
  }

  // 6. Handle Plain Objects (and skip internal properties)
  const cleanObj: any = {};
  try {
    const keys = Object.keys(obj);
    for (const key of keys) {
      // Skip hidden/internal properties which are likely to cause circularity in SDK objects
      if (key.startsWith('_') || key.startsWith('__')) continue;
      
      const value = obj[key];
      // Only recurse if it's an object/array
      if (value !== null && typeof value === 'object') {
        cleanObj[key] = sanitize(value, seen);
      } else {
        cleanObj[key] = value;
      }
    }
  } catch (e) {
    return '[Complex Object]';
  }
  
  return cleanObj;
};

export const AuditService = {
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
        // Create fresh WeakSets for each sanitize call to be safe
        diff = {
          before: entry.before ? sanitize(entry.before, new WeakSet()) : null,
          after: entry.after ? sanitize(entry.after, new WeakSet()) : null
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

      await addDoc(collection(db, COLLECTION), logData);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Audit] ${entry.action} ${entry.module}: ${entry.summary}`, logData);
      }
    } catch (error) {
      console.error("[Audit] Failed to write log:", error);
    }
  }
};

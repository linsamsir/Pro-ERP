
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

// Simple sanitizer to remove Firestore Refs and complex objects that cause JSON cycles
const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Handle Firestore Timestamp (simple check for seconds/nanoseconds)
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }
  
  // Handle Date
  if (obj instanceof Date) return obj.toISOString();

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  // Handle Firestore References (they usually have 'firestore' property or 'path')
  // We just convert them to a string representation to avoid cycles
  if (obj.constructor && obj.constructor.name === 'DocumentReference') {
    return `Ref(${obj.path || 'unknown'})`;
  }
  if (obj.constructor && obj.constructor.name === 'CollectionReference') {
    return `ColRef(${obj.path || 'unknown'})`;
  }

  // Handle Object
  const cleanObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip internal Firebase keys or potential cycle causes if identifiable
      cleanObj[key] = sanitize(obj[key]);
    }
  }
  return cleanObj;
};

export const AuditService = {
  log: async (entry: AuditEntry, actor: User | null) => {
    try {
      // If no actor (e.g. system event or login fail), use a fallback or skip
      // For LOGIN action, actor might be populated just now.
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

      // Calculate simple diff if not provided but before/after exist
      let diff = null;
      if (entry.before || entry.after) {
        diff = {
          before: entry.before ? sanitize(entry.before) : null,
          after: entry.after ? sanitize(entry.after) : null
        };
      }

      const logData = {
        ts: serverTimestamp(), // Use server time
        actor: actorData,
        module: entry.module,
        action: entry.action,
        target: {
          entityType: entry.module, // Simplified mapping
          entityId: entry.entityId || 'N/A',
          entityName: entry.entityName || ''
        },
        summary: entry.summary,
        diff: diff,
        createdAt: new Date().toISOString() // Client-side fallback for UI immediate render
      };

      await addDoc(collection(db, COLLECTION), logData);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Audit] ${entry.action} ${entry.module}: ${entry.summary}`, logData);
      }

    } catch (error) {
      console.error("[Audit] Failed to write log:", error);
      // Do not throw, to prevent blocking the main operation
    }
  }
};

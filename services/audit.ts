
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
          before: entry.before || null,
          after: entry.after || null
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

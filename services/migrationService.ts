
import { db } from './firebase';
import { collection, getDocs, writeBatch, doc, query, orderBy, limit } from 'firebase/firestore';
import { ServiceItem, Job, Customer } from '../types';
import { COLLECTIONS } from './firestorePaths';

// Types for Migration Logic
export type DetectedServiceType = 'TOWER' | 'PIPE' | 'BOTH' | 'UNKNOWN';

export interface JobFixDiff {
  jobId: string;
  contactPerson: string;
  note: string;
  oldType: ServiceItem[];
  newType: ServiceItem[];
}

export interface CustomerFixDiff {
  customerId: string;
  displayName: string;
  jobCount: number;
  oldStatus: boolean;
  newStatus: boolean;
}

export interface MigrationStats {
  scanned: number;
  toFix: number;
  diffs: (JobFixDiff | CustomerFixDiff)[];
}

// 1. Parsing Logic
export const parseServiceTypeFromNote = (note: string): DetectedServiceType => {
  if (!note) return 'UNKNOWN';

  // Normalize: Full-width to half-width, remove spaces, lower case
  const n = note
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .toLowerCase();

  // Keyword Checks
  const hasTank = n.includes('水塔');
  const hasPipe = n.includes('水管');
  
  // Specific Patterns for "Both" explicitly written
  // e.g. [水塔+水管], 水塔&水管, 水塔/水管
  const explicitBoth = /[+＋&＆／\/]/.test(n) && hasTank && hasPipe;

  // Logic Priority
  if (explicitBoth || (hasTank && hasPipe)) {
    return 'BOTH';
  }
  if (hasPipe) {
    return 'PIPE';
  }
  if (hasTank) {
    return 'TOWER';
  }

  return 'UNKNOWN';
};

const mapTypeToServiceItems = (type: DetectedServiceType, currentItems: ServiceItem[]): ServiceItem[] => {
  switch (type) {
    case 'BOTH': return [ServiceItem.TANK, ServiceItem.PIPE];
    case 'PIPE': return [ServiceItem.PIPE];
    case 'TOWER': return [ServiceItem.TANK];
    case 'UNKNOWN': return currentItems.length > 0 ? currentItems : [ServiceItem.TANK]; // Keep existing or default
  }
};

const arraysEqual = (a: ServiceItem[], b: ServiceItem[]) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every(x => setA.has(x));
};

// 2. Migration Service
export const MigrationService = {
  
  // --- A. Scan Jobs ---
  scanJobsForFix: async (): Promise<MigrationStats> => {
    console.log('[Migration] Scanning Jobs...');
    const jobsRef = collection(db, COLLECTIONS.JOBS);
    const snap = await getDocs(jobsRef);
    
    const diffs: JobFixDiff[] = [];
    
    snap.docs.forEach(d => {
      const job = d.data() as Job;
      const note = job.serviceNote || '';
      
      const detectedType = parseServiceTypeFromNote(note);
      
      // If UNKNOWN, skip overwriting (assume manual entry is correct or keep default)
      // Unless current is empty? No, keep safe. Only overwrite if we found a match.
      if (detectedType === 'UNKNOWN') return;

      const newItems = mapTypeToServiceItems(detectedType, job.serviceItems);
      
      // Check if update needed
      if (!arraysEqual(job.serviceItems || [], newItems)) {
        diffs.push({
          jobId: d.id, // Use doc ID
          contactPerson: job.contactPerson,
          note: note,
          oldType: job.serviceItems || [],
          newType: newItems
        });
      }
    });

    return {
      scanned: snap.size,
      toFix: diffs.length,
      diffs: diffs
    };
  },

  // --- B. Scan Customers ---
  scanCustomersForFix: async (): Promise<MigrationStats> => {
    console.log('[Migration] Scanning Customers...');
    
    // 1. Get Job Counts Map
    const jobsRef = collection(db, COLLECTIONS.JOBS);
    const jobsSnap = await getDocs(jobsRef);
    const counts: Record<string, number> = {};
    
    jobsSnap.docs.forEach(d => {
      const j = d.data() as Job;
      if (j.customerId) {
        counts[j.customerId] = (counts[j.customerId] || 0) + 1;
      }
    });

    // 2. Scan Customers
    const custRef = collection(db, COLLECTIONS.CUSTOMERS);
    const custSnap = await getDocs(custRef);
    const diffs: CustomerFixDiff[] = [];

    custSnap.docs.forEach(d => {
      const c = d.data() as Customer;
      // Prefer business ID (customer_id) for map lookup, falling back to docId if logic mixed
      // Ideally, jobs store 'customer_id' (e.g. C001).
      const idKey = c.customer_id; 
      
      const actualCount = counts[idKey] || 0;
      const shouldBeReturning = actualCount >= 2;
      const currentReturning = !!c.is_returning;

      if (currentReturning !== shouldBeReturning) {
        diffs.push({
          customerId: d.id, // Doc ID for update
          displayName: c.displayName,
          jobCount: actualCount,
          oldStatus: currentReturning,
          newStatus: shouldBeReturning
        });
      }
    });

    return {
      scanned: custSnap.size,
      toFix: diffs.length,
      diffs: diffs
    };
  },

  // --- C. Execute Fix (Batch) ---
  executeJobFix: async (diffs: JobFixDiff[], onProgress: (done: number) => void) => {
    const BATCH_SIZE = 450; // Safety margin below 500
    let processed = 0;

    for (let i = 0; i < diffs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = diffs.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(diff => {
        const ref = doc(db, COLLECTIONS.JOBS, diff.jobId);
        batch.update(ref, { 
          serviceItems: diff.newType,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      processed += chunk.length;
      onProgress(processed);
    }
  },

  executeCustomerFix: async (diffs: CustomerFixDiff[], onProgress: (done: number) => void) => {
    const BATCH_SIZE = 450;
    let processed = 0;

    for (let i = 0; i < diffs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = diffs.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(diff => {
        const ref = doc(db, COLLECTIONS.CUSTOMERS, diff.customerId);
        batch.update(ref, { 
          is_returning: diff.newStatus,
          updated_at: new Date().toISOString()
        });
      });

      await batch.commit();
      processed += chunk.length;
      onProgress(processed);
    }
  }
};

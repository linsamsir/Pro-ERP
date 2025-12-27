
import { User, UserRole } from '../types';
import { auth as firebaseAuth, db as firebaseDb } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Username to Email mapping for "Login" convenience
const EMAIL_DOMAIN = "cleanvillage.erp";
const USER_MAPPING: Record<string, string> = {
  'linsamsir': `linsamsir@${EMAIL_DOMAIN}`,
  'carol7338425': `carol7338425@${EMAIL_DOMAIN}`,
  'staff': `staff@${EMAIL_DOMAIN}`,
  'admin': `admin@${EMAIL_DOMAIN}`
};

// Map Email to Role (Fallback if not in DB)
const ROLE_MAPPING: Record<string, {name: string, role: UserRole}> = {
  [`linsamsir@${EMAIL_DOMAIN}`]: { name: '林老闆', role: 'BOSS' },
  [`carol7338425@${EMAIL_DOMAIN}`]: { name: 'Carol', role: 'MANAGER' },
  [`staff@${EMAIL_DOMAIN}`]: { name: '小幫手', role: 'STAFF' },
  [`admin@${EMAIL_DOMAIN}`]: { name: 'Admin', role: 'DECOY' }
};

let currentUser: User | null = null;
let authInitialized = false;

// Helpers
export const auth = {
  // Async Login
  login: async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    const email = USER_MAPPING[username] || username; // Allow direct email or username
    
    try {
      // Check if auth instance is properly configured with an API key
      if (!firebaseAuth.app || !firebaseAuth.app.options || !firebaseAuth.app.options.apiKey) {
        throw { code: 'auth/api-key-missing' };
      }

      const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
      // Determine Role
      const user = await auth.syncUserRole(result.user);
      return { success: true, user };
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "登入失敗";
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-valid' || error.code === 'auth/api-key-missing') {
        msg = "系統配置錯誤：Firebase API Key 無效或缺失。請確認環境變數已正確設定。";
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = "帳號或密碼錯誤";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "登入嘗試過多，請稍後再試";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "網路連線失敗，請檢查網路狀態";
      }
      
      return { success: false, message: msg };
    }
  },

  logout: async () => {
    try {
      await signOut(firebaseAuth);
      currentUser = null;
      window.location.href = "/"; // Force redirect
    } catch (error) {
      console.error("Logout Error:", error);
    }
  },

  // State Management
  init: (callback: (user: User | null) => void) => {
    if (authInitialized) return callback(currentUser);
    
    // Safety check for uninitialized auth or missing config
    if (!firebaseAuth.app || !firebaseAuth.app.options || !firebaseAuth.app.options.apiKey) {
      authInitialized = true;
      return callback(null);
    }

    onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        currentUser = await auth.syncUserRole(fbUser);
      } else {
        currentUser = null;
      }
      authInitialized = true;
      callback(currentUser);
    });
  },

  getCurrentUser: (): User | null => {
    return currentUser;
  },

  isAuthenticated: (): boolean => {
    return !!currentUser;
  },

  // Get/Set User Role from Firestore 'users' collection
  syncUserRole: async (fbUser: FirebaseUser): Promise<User> => {
    const userRef = doc(firebaseDb, "users", fbUser.uid);
    const userSnap = await getDoc(userRef);
    
    let role: UserRole = 'STAFF';
    let name = fbUser.displayName || 'User';

    if (userSnap.exists()) {
      const data = userSnap.data();
      role = data.role as UserRole;
      name = data.name;
    } else {
      // First time login? Seed from hardcoded mapping
      const mapping = ROLE_MAPPING[fbUser.email || ''] || { name: 'Unknown', role: 'STAFF' };
      role = mapping.role;
      name = mapping.name;
      
      // Save to DB for future reference
      try {
        await setDoc(userRef, { email: fbUser.email, role, name }, { merge: true });
      } catch (e) {
        console.warn("Failed to sync user role to DB:", e);
      }
    }

    const appUser: User = {
      id: fbUser.uid,
      username: fbUser.email?.split('@')[0] || 'user',
      name,
      role,
      passwordHash: 'PROTECTED'
    };
    return appUser;
  },

  // Permissions
  canWrite: (): boolean => {
    return currentUser?.role === 'BOSS' || currentUser?.role === 'MANAGER';
  },

  canViewData: (): boolean => {
    return ['BOSS', 'MANAGER', 'STAFF'].includes(currentUser?.role || '');
  },

  isAdmin: (): boolean => {
    return currentUser?.role === 'BOSS' || currentUser?.role === 'MANAGER';
  },

  // Data Masking for STAFF
  maskSensitiveData: <T>(data: T, type: 'money' | 'phone' | 'address' | 'generic'): string | number | T => {
    const user = currentUser;
    
    if (user?.role === 'BOSS' || user?.role === 'MANAGER') return data;
    if (user?.role === 'DECOY') return '---';

    if (user?.role === 'STAFF') {
      if (type === 'money') return '****';
      if (type === 'phone' && typeof data === 'string') {
        if (data.length < 4) return data;
        return data.substring(0, 4) + '******'; // Mask middle/end
      }
      if (type === 'address' && typeof data === 'string') {
        // Only show City/District (simple heuristic: first 6 chars)
        return data.length > 6 ? data.substring(0, 6) + '...' : data;
      }
      if (type === 'generic') return '****';
    }
    return data;
  }
};

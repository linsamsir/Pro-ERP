
import { User, UserRole } from '../types';
import { auth as firebaseAuth, db as firebaseDb } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AuditService } from './audit';

const EMAIL_DOMAIN = "cleanvillage.erp";

// Internal Mapping for convenience (username -> email)
// This allows users to login with just "linsamsir"
const USERNAME_MAP: Record<string, string> = {
  'linsamsir': `linsamsir@${EMAIL_DOMAIN}`,
  'carol7338425': `carol7338425@${EMAIL_DOMAIN}`,
  'staff': `staff@${EMAIL_DOMAIN}`,
  'admin': `admin@${EMAIL_DOMAIN}`
};

// Default Roles for Initialization
const DEFAULT_ROLES: Record<string, { name: string, role: UserRole }> = {
  'linsamsir': { name: '林老闆', role: 'BOSS' },
  'carol7338425': { name: 'Carol', role: 'MANAGER' },
  'staff': { name: '小幫手', role: 'STAFF' },
  'admin': { name: 'Admin (Decoy)', role: 'DECOY' }
};

let currentUser: User | null = null;
let authInitialized = false;

export const auth = {
  login: async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    // 1. Resolve Email
    let email = usernameOrEmail;
    if (!email.includes('@')) {
      email = USERNAME_MAP[usernameOrEmail] || `${usernameOrEmail}@${EMAIL_DOMAIN}`;
    }

    try {
      // 2. Firebase Login
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      
      // 3. Sync Role & Get User Object
      const appUser = await auth.syncUserRole(cred.user);
      currentUser = appUser;

      // 4. Audit Log
      await AuditService.log({
        action: 'LOGIN',
        module: 'AUTH',
        summary: `使用者登入: ${appUser.name} (${appUser.role})`,
        entityId: appUser.id
      }, appUser);

      return { success: true, user: appUser };

    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = "登入失敗";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') msg = "帳號或密碼錯誤";
      if (error.code === 'auth/too-many-requests') msg = "嘗試次數過多，請稍後";
      if (error.code === 'auth/invalid-api-key') msg = "系統設定錯誤 (API Key Invalid)";
      
      return { success: false, message: msg };
    }
  },

  logout: async () => {
    if (currentUser) {
      await AuditService.log({
        action: 'LOGOUT',
        module: 'AUTH',
        summary: `使用者登出: ${currentUser.name}`,
        entityId: currentUser.id
      }, currentUser);
    }
    
    await signOut(firebaseAuth);
    currentUser = null;
    window.location.href = "/"; 
  },

  init: (callback: (user: User | null) => void) => {
    if (authInitialized) {
      callback(currentUser);
      return;
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

  syncUserRole: async (fbUser: FirebaseUser): Promise<User> => {
    const userRef = doc(firebaseDb, "users", fbUser.uid);
    const userSnap = await getDoc(userRef);
    const username = fbUser.email?.split('@')[0] || 'unknown';

    let role: UserRole = 'STAFF';
    let name = fbUser.displayName || username;

    if (userSnap.exists()) {
      // Existing user in DB
      const data = userSnap.data();
      role = data.role as UserRole;
      name = data.name;
      
      // Update last login
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    } else {
      // New user (or first run): Initialize from hardcoded defaults
      const def = DEFAULT_ROLES[username] || { name: 'Unknown Staff', role: 'STAFF' };
      role = def.role;
      name = def.name;

      // Write to DB
      await setDoc(userRef, {
        email: fbUser.email,
        username,
        name,
        role,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    }

    return {
      id: fbUser.uid,
      username,
      name,
      role,
      passwordHash: 'PROTECTED'
    };
  },

  getCurrentUser: () => currentUser,
  isAuthenticated: () => !!currentUser,
  
  // Permissions
  canWrite: () => {
    if (!currentUser) return false;
    return ['BOSS', 'MANAGER'].includes(currentUser.role);
  },
  
  isAdmin: () => {
    if (!currentUser) return false;
    return ['BOSS', 'MANAGER'].includes(currentUser.role);
  },

  // Data Masking
  maskSensitiveData: <T>(data: T, type: 'money' | 'phone' | 'address' | 'generic'): string | number | T => {
    const user = currentUser;
    if (!user) return '***';
    
    // Boss/Manager see everything
    if (user.role === 'BOSS' || user.role === 'MANAGER') return data;
    
    // Decoy sees nothing useful
    if (user.role === 'DECOY') return '---';

    // Staff masking rules
    if (user.role === 'STAFF') {
      if (type === 'money') return '****';
      if (type === 'phone' && typeof data === 'string') {
        // Show first 4, mask rest: 0912******
        return data.length > 4 ? `${data.substring(0, 4)}******` : '******';
      }
      if (type === 'address' && typeof data === 'string') {
        return data.length > 6 ? `${data.substring(0, 6)}...` : '***';
      }
      return '****';
    }
    return data;
  }
};

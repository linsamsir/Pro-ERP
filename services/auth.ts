
import { User, UserRole } from '../types';
import { db } from './db';

const SESSION_KEY = 'erp_session_v1';

// Simple "Hash" for demo purposes. In production, use bcrypt/argon2.
const hashPassword = (pwd: string) => `HASH_${btoa(pwd)}`;

// Specific Users Configuration
const SYSTEM_USERS: User[] = [
  { id: 'u_boss', username: 'linsamsir', name: '林老闆', role: 'BOSS', passwordHash: hashPassword('linsamsir') },
  { id: 'u_manager', username: 'carol7338425', name: 'Carol', role: 'MANAGER', passwordHash: hashPassword('carol7338425') },
  { id: 'u_staff', username: 'staff', name: '小幫手', role: 'STAFF', passwordHash: hashPassword('staff') },
  { id: 'u_decoy', username: 'admin', name: 'Admin', role: 'DECOY', passwordHash: hashPassword('admin') }
];

export const auth = {
  login: (username: string, password: string): { success: boolean; user?: User; message?: string } => {
    // 1. Check against hardcoded system users first (Level 0 priority)
    const systemUser = SYSTEM_USERS.find(u => u.username === username);
    
    if (!systemUser) {
      return { success: false, message: '帳號或密碼錯誤' }; 
    }

    if (systemUser.passwordHash !== hashPassword(password)) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    // 2. Set Session
    const sessionData = JSON.stringify(systemUser);
    localStorage.setItem(SESSION_KEY, sessionData);
    
    // 3. Log it (only if not decoy to avoid polluting logs, or log it as alert?)
    // Let's log DECOY access as a security event if needed, but for now standard logging.
    db.audit.log(
      systemUser,
      'AUTH',
      'LOGIN',
      { entityType: 'User', entityId: systemUser.id, entityName: systemUser.name },
      systemUser.role === 'DECOY' ? '誘餌帳號登入嘗試' : '使用者登入'
    );

    return { success: true, user: systemUser };
  },

  logout: () => {
    const user = auth.getCurrentUser();
    if (user && user.role !== 'DECOY') {
      db.audit.log(
        user,
        'AUTH',
        'LOGOUT',
        { entityType: 'User', entityId: user.id, entityName: user.name },
        '使用者登出'
      );
    }
    localStorage.removeItem(SESSION_KEY);
    // Force reload to clear memory states and redirect
    window.location.href = "/";
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    return !!auth.getCurrentUser();
  },

  // --- Permission Helpers ---

  // Write Access: Only Boss and Manager
  canWrite: (): boolean => {
    const user = auth.getCurrentUser();
    return user?.role === 'BOSS' || user?.role === 'MANAGER';
  },

  // View Access: Boss, Manager, and Staff (Decoy is blocked from real data)
  canViewData: (): boolean => {
    const user = auth.getCurrentUser();
    return ['BOSS', 'MANAGER', 'STAFF'].includes(user?.role || '');
  },

  // Admin/Sensitive Features (Settings, Full Logs, Financials)
  isAdmin: (): boolean => {
    const user = auth.getCurrentUser();
    return user?.role === 'BOSS' || user?.role === 'MANAGER';
  },

  // --- Data Masking Logic ---
  maskSensitiveData: <T>(data: T, type: 'money' | 'phone' | 'address' | 'generic'): string | number | T => {
    const user = auth.getCurrentUser();
    
    // Boss & Manager see everything
    if (user?.role === 'BOSS' || user?.role === 'MANAGER') {
      return data;
    }

    // Decoy sees nothing/garbage
    if (user?.role === 'DECOY') {
      return '---';
    }

    // Staff Rules
    if (user?.role === 'STAFF') {
      if (type === 'money') return '****';
      if (type === 'phone' && typeof data === 'string') {
        // Show last 3 digits: 0912345678 -> *******678
        if (data.length < 4) return data;
        return '*'.repeat(data.length - 3) + data.slice(-3);
      }
      if (type === 'address' && typeof data === 'string') {
        // Simple heuristic: hide numbers, keep text? Or just hide everything after 3 chars?
        // Let's hide street numbers. Replace digits with *.
        // "台北市信義區信義路五段7號" -> "台北市信義區信義路五段*號"
        // Better: Keep City/District, mask detailed address.
        // For simplicity: Mask all digits.
        return data.replace(/\d/g, '*');
      }
      if (type === 'generic') return '****';
    }

    return data;
  }
};

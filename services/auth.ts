
import { User, UserRole } from '../types';
import { db } from './db';

const SESSION_KEY = 'erp_session_v1';

// Simple "Hash" for demo purposes (Level 0)
// In production, use bcrypt/argon2 on the backend
const hashPassword = (pwd: string) => `HASH_${btoa(pwd)}`;

export const auth = {
  login: (username: string, password: string): { success: boolean; user?: User; message?: string } => {
    // 1. Get users from DB
    const users = db.users.getAll();
    const user = users.find(u => u.username === username);

    if (!user) {
      // Mock timing attack protection
      return { success: false, message: '帳號或密碼錯誤' }; 
    }

    if (user.passwordHash !== hashPassword(password)) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    // 2. Set Session
    const sessionData = JSON.stringify(user);
    localStorage.setItem(SESSION_KEY, sessionData);
    
    // 3. Log it
    db.audit.log(
      user,
      'AUTH',
      'LOGIN',
      { entityType: 'User', entityId: user.id, entityName: user.name },
      '使用者登入'
    );

    return { success: true, user };
  },

  logout: () => {
    const user = auth.getCurrentUser();
    if (user) {
      db.audit.log(
        user,
        'AUTH',
        'LOGOUT',
        { entityType: 'User', entityId: user.id, entityName: user.name },
        '使用者登出'
      );
    }
    localStorage.removeItem(SESSION_KEY);
    // Force reload to clear memory states
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

  // Check Permission
  canWrite: (): boolean => {
    const user = auth.getCurrentUser();
    return user?.role === 'OWNER'; // Only Owner can write
  },

  // Utils
  hash: hashPassword
};


import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helper to get environment variables safely
const getEnv = (key: string) => {
  // Try Vite
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // Try Process (Standard/CRA/Next)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  // Try Window (Runtime injection)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env[key]) {
    // @ts-ignore
    return window.process.env[key];
  }
  return '';
};

const apiKey = getEnv('VITE_FIREBASE_API_KEY');

// Fallback to avoid "auth/invalid-api-key" crash if env vars are missing
if (!apiKey) {
  console.warn("⚠️ Firebase Config Missing: VITE_FIREBASE_API_KEY not found. App running in fallback mode.");
}

const firebaseConfig = {
  apiKey: apiKey || "AIzaSy_FALLBACK_KEY_PREVENT_CRASH", 
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "cleanvillage.firebaseapp.com",
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || "cleanvillage-erp",
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Fix: Use a safer way to access import.meta.env by casting to any to avoid TypeScript "Property 'env' does not exist" errors
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey:
    env.VITE_FIREBASE_API_KEY ||
    "AIzaSyCMCV6_b5xFH9C_Bpu4n8xaqV99r24D84w",

  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    "clean-village-erp.firebaseapp.com",

  projectId:
    env.VITE_FIREBASE_PROJECT_ID ||
    "clean-village-erp",

  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    "clean-village-erp.firebasestorage.app",

  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "130908203228",

  appId:
    env.VITE_FIREBASE_APP_ID ||
    "1:130908203228:web:4e47cfb370ff44e640ac19",
};

// Fix: Use the local env helper to safely check for DEV mode
if (env.DEV) {
  console.log("[Firebase Config]", firebaseConfig);
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Helper to access env safely
const env = (import.meta as any).env || {};

// Configuration with Demo Fallbacks
// This ensures the app doesn't crash if VITE_FIREBASE_* variables are missing in Vercel/Local
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCMCV6_b5xFH9C_Bpu4n8xaqV99r24D84w",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "clean-village-erp.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "clean-village-erp",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "clean-village-erp.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "130908203228",
  appId: env.VITE_FIREBASE_APP_ID || "1:130908203228:web:4e47cfb370ff44e640ac19",
};

// Log warning if using fallback to avoid confusion
if (!env.VITE_FIREBASE_API_KEY) {
  console.warn(
    "[Firebase] No VITE_FIREBASE_API_KEY found. Using DEMO configuration.\n" +
    "If you have set environment variables in Vercel, please Redeploy the project to apply them."
  );
}

// Initialize
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("[Firebase] Initialization failed:", e);
  throw e;
}

export { app, auth, db };
export default app;

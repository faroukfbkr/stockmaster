import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Get Firebase config from Vite environment variables or fallback to default project credentials
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyABo8kwTsbJoPMpROSnUb2eMXtJrVRtAV4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0571190893.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0571190893",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0571190893.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "240181632802",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:240181632802:web:95180d37dd28b9cc520f7b",
};

// Check if configuration is complete
export const isFirebaseConfigured = !!(
  config.apiKey &&
  config.authDomain &&
  config.projectId
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

export { app, db, auth, storage, googleProvider };

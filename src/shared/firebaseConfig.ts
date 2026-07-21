// Lightweight Firebase config check — deliberately has ZERO imports from the `firebase`
// package. src/shared/data.ts imports `hasFirebaseConfig` from HERE (not from firebase.ts)
// so that demo-mode loads never pull in the firebase SDK chunk (~600kB) just to learn that
// there's no config. The actual SDK only loads via the dynamic import in
// src/shared/firestoreDriver.ts, and only when hasFirebaseConfig is true.

export interface FirebaseConfigShape {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const env = import.meta.env;

export const firebaseConfig: FirebaseConfigShape = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseConfig: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

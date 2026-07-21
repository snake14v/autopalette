// Firebase bootstrap — the actual SDK initialization. This file statically imports the
// `firebase` package, so it must NEVER be imported from src/shared/data.ts or any code path
// that runs in demo mode. It is only reached via the dynamic `import('./firestoreDriver')` in
// src/shared/data.ts::getDriver(), which only happens when hasFirebaseConfig is true — that
// flag itself lives in src/shared/firebaseConfig.ts (zero firebase imports) so checking it
// never pulls in this ~600kB chunk.
//
// -----------------------------------------------------------------------------------------
// SETUP STEPS (owner does this once, in the Firebase console):
// 1. Go to https://console.firebase.google.com and create a new project (e.g. "autopalette").
// 2. Build > Authentication > Sign-in method: enable "Email/Password".
// 3. Build > Authentication > Users: "Add user" — create the admin's email + password.
// 4. Build > Firestore Database: create a database (production mode, nearest region e.g.
//    asia-south1). Then deploy firestore.rules from this repo (`firebase deploy --only
//    firestore:rules`, after `firebase login` + `firebase use <project-id>`).
// 5. In Firestore, create a document at users/{uid} where {uid} is the admin user's UID
//    (Authentication tab > copy the User UID). Set field: role (string) = "admin".
//    This is the "Cha Angadi pattern" admin check used by src/shared/data.ts.
// 6. Project settings (gear icon) > General > "Your apps" > add a Web app. Copy the
//    firebaseConfig values into a real .env file at the repo root (copy .env.example to
//    .env first) — Vite only reads vars prefixed VITE_.
// 7. Restart `npm run dev` / rebuild so Vite picks up the new env vars.
// -----------------------------------------------------------------------------------------

import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { firebaseConfig, hasFirebaseConfig } from './firebaseConfig';

export { hasFirebaseConfig };

let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (hasFirebaseConfig) {
  const app = initializeApp(firebaseConfig as FirebaseOptions);
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    // Our types use optional fields; the demo driver drops undefined silently but
    // Firestore rejects it ("Unsupported field value: undefined"). Strip globally
    // here so every write path behaves identically in both drivers.
    ignoreUndefinedProperties: true,
  });
  authInstance = getAuth(app);
}

// Only non-null when hasFirebaseConfig is true — callers in the firestore driver may
// assume that, since getDriver() only selects that driver when hasFirebaseConfig is true.
export const firestoreDb = firestoreInstance;
export const firebaseAuth = authInstance;

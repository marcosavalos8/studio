"use client";

import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";

// This function ensures we initialize firebase only once.
const getFirebaseApp = (): FirebaseApp => {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

const app = getFirebaseApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

// Enable offline persistence for Firestore
// This allows the app to work offline and sync when connection returns
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn("Firestore persistence failed: Multiple tabs open");
    } else if (err.code === "unimplemented") {
      // The current browser doesn't support persistence
      console.warn("Firestore persistence not supported in this browser");
    }
  });
}

// exports used by other firebase modules (provider/hooks) — do NOT re-export provider/hooks here to avoid circular imports
export { app, auth, firestore };
export const firebaseApp = app;

/**
 * Lightweight "use" helpers that simply return the initialized instances.
 * These are not tied to React context and avoid creating circular imports.
 * Components can call them as useFirestore(), useAuth(), useApp() as before.
 */
export function useFirestore(): Firestore {
  return firestore;
}

export function useAuth(): Auth {
  return auth;
}

export function useApp(): FirebaseApp {
  return app;
}

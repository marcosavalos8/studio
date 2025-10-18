"use client";

import React, {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { app, auth, firestore } from "@/firebase/index";

export interface FirebaseContextValue {
  app: typeof app;
  auth: typeof auth;
  firestore: typeof firestore;
  user: User | null;
  authReady: boolean;
  signInAnon: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

export const FirebaseContext = createContext<FirebaseContextValue>({
  app: app as any,
  auth: auth as any,
  firestore: firestore as any,
  user: null,
  authReady: false,
  signInAnon: async () => {},
  signInEmail: async () => {},
  signOutUser: async () => {},
});

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setAuthReady(true);
      },
      () => {
        // auth subsystem errored; mark ready so UI doesn't block forever
        setAuthReady(true);
      }
    );

    // Try anonymous sign-in automatically only if env flag enabled.
    // Set NEXT_PUBLIC_FIREBASE_ANONYMOUS=true in Vercel/env if you want this behavior.
    if (process.env.NEXT_PUBLIC_FIREBASE_ANONYMOUS === "true") {
      // ignore error (e.g. anonymous disabled) — onAuthStateChanged will still fire
      signInAnonymously(auth).catch(() => {});
    }

    return () => unsub();
  }, []);

  async function signInAnon() {
    await signInAnonymously(auth);
  }

  async function signInEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOutUser() {
    await signOut(auth);
  }

  return (
    <FirebaseContext.Provider
      value={{
        app,
        auth,
        firestore,
        user,
        authReady,
        signInAnon,
        signInEmail,
        signOutUser,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

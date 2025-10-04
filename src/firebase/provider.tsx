'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

// Dynamically import the listener only on the client side
const FirebaseErrorListener = dynamic(() =>
  import('@/components/FirebaseErrorListener').then((mod) => mod.FirebaseErrorListener),
  { ssr: false }
);

interface FirebaseProviderProps {
  children: ReactNode;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

// Ensure Firebase is initialized only once
let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const services = { firebaseApp, firestore, auth };


export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
}) => {
  return (
    <FirebaseContext.Provider value={services}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider.');
  }
  return context.firebaseApp;
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider.');
  }
  return context.auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider.');
  }
  return context.firestore;
};

type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const memoized = useMemo(factory, deps);

  // This check is a bit of a hack to satisfy the useCollection/useDoc hooks
  // that they are receiving a memoized value.
  if (
    memoized !== null &&
    typeof memoized === 'object' &&
    !('__memo' in memoized)
  ) {
    Object.defineProperty(memoized, '__memo', {
      value: true,
      enumerable: false,
    });
  }

  return memoized as MemoFirebase<T>;
}

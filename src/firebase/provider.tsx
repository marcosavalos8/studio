'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FirebaseApp, initializeApp } from 'firebase/app';
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

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
}) => {
  const [services, setServices] = useState<FirebaseContextState | null>(null);

  useEffect(() => {
    // This ensures Firebase is initialized only on the client side.
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    setServices({ firebaseApp: app, firestore, auth });
  }, []);

  if (!services) {
    // You can render a loading state here if needed, or just null
    return null;
  }

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

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T | (MemoFirebase<T>) {
  const memoized = React.useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  if (!('__memo' in memoized)) {
    (memoized as MemoFirebase<T>).__memo = true;
  }
  
  return memoized;
}

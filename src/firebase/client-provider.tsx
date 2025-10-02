'use client';

import { initializeFirebase } from '@/firebase';
import { FirebaseProvider } from '@/firebase/provider';
import type { ReactNode } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const { app, firestore, auth } = initializeFirebase();

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider app={app} firestore={firestore} auth={auth}>
      {children}
      <FirebaseErrorListener />
    </FirebaseProvider>
  );
}

'use client'

import { FirebaseClientProvider } from '@/firebase/client-provider'
import { useUser, useAuth } from '@/firebase/provider'
import { useEffect } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { Loader2 } from 'lucide-react'

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const auth = useAuth()

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      signInAnonymously(auth).catch((error) => {
        console.error("Anonymous sign-in failed:", error);
      });
    }
  }, [user, isUserLoading, auth]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FirebaseClientProvider>
      <AuthWrapper>
        {children}
      </AuthWrapper>
    </FirebaseClientProvider>
  );
}

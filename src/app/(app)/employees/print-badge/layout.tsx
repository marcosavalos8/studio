'use client'

import { FirebaseProvider } from '@/firebase/provider'
import { useUser } from '@/firebase/auth/use-user'
import { useEffect } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { Loader2 } from 'lucide-react'
import { auth } from '@/firebase'

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  useEffect(() => {
    if (!loading && !user) {
      signInAnonymously(auth).catch((error) => {
        console.error("Anonymous sign-in failed:", error);
      });
    }
  }, [user, loading]);

  if (loading && !user) { // Only show loader if we are actually waiting for the user
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
    <FirebaseProvider>
      <AuthWrapper>
        {children}
      </AuthWrapper>
    </FirebaseProvider>
  );
}

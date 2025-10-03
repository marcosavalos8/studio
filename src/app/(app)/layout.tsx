'use client'

import { AppHeader } from '@/components/layout/header'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { FirebaseClientProvider } from '@/firebase/client-provider'
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

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FirebaseClientProvider>
      <AuthWrapper>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </AuthWrapper>
    </FirebaseClientProvider>
  )
}

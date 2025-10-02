
'use client'

import { AppHeader } from '@/components/layout/header'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
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


export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const path = (children as any)?.props?.childProp?.segment
  if (path?.startsWith('employees/print-badge')) {
    return <FirebaseClientProvider><AuthWrapper>{children}</AuthWrapper></FirebaseClientProvider>
  }
  return (
    <FirebaseClientProvider>
      <AuthWrapper>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-background p-0">
            <AppHeader />
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </AuthWrapper>
    </FirebaseClientProvider>
  )
}

'use client'

import { AppHeader } from '@/components/layout/header'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { FirebaseProvider } from '@/firebase/provider'
import { useUser } from '@/firebase/auth/use-user'
import { useEffect } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { Loader2 } from 'lucide-react'
import { auth } from '@/firebase'
import { NetworkStatusIndicator } from '@/components/network-status-indicator'
import { PagePrecacher } from '@/components/page-precacher'
import { DataPrecacher } from '@/components/data-precacher'
import { useSettings } from '@/contexts/settings-context'

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const { settings } = useSettings()

  useEffect(() => {
    if (!loading && !user) {
      signInAnonymously(auth).catch((error: unknown) => {
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

  const isRightSidebar = settings.sidebarPosition === 'right';

  return (
    <SidebarProvider>
      <div className={`flex w-full ${isRightSidebar ? 'flex-row-reverse' : ''}`}>
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader />
          <NetworkStatusIndicator />
          <PagePrecacher />
          <DataPrecacher />
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


export default function AppLayout({
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
  )
}

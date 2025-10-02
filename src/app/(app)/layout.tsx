import { AppHeader } from '@/components/layout/header'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { FirebaseClientProvider } from '@/firebase/client-provider'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const path = (children as any)?.props?.childProp?.segment
  if (path === 'print-badge') {
    return <>{children}</>
  }
  return (
    <FirebaseClientProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-background p-0">
          <AppHeader />
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </FirebaseClientProvider>
  )
}

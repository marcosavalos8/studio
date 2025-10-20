'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Logo } from "@/components/icons/logo"
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  FileText,
  DollarSign,
  Settings,
  LifeBuoy,
  QrCode,
} from "lucide-react"

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/time-tracking", label: "Time Tracking", icon: QrCode },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/payroll", label: "Payroll", icon: FileText },
  { href: "/invoicing", label: "Invoicing", icon: DollarSign },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="size-7 md:size-8 text-primary flex-shrink-0" />
          <span className="text-base md:text-lg font-semibold text-sidebar-foreground truncate">FieldTack WA</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                  className="px-3 py-2"
                >
                  <div>
                    <item.icon className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Support" className="px-3 py-2">
              <LifeBuoy className="flex-shrink-0" />
              <span className="truncate">Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" className="px-3 py-2">
              <Settings className="flex-shrink-0" />
              <span className="truncate">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

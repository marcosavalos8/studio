"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/icons/logo";
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
  Tag,
  UserCog,
} from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/time-tracking", label: "Time Tracking", icon: QrCode, adminOnly: false },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: false },
  { href: "/clients", label: "Clients", icon: Briefcase, adminOnly: false },
  { href: "/tasks", label: "Tasks", icon: ClipboardList, adminOnly: false },
  { href: "/payroll", label: "Payroll", icon: FileText, adminOnly: true },
  { href: "/invoicing", label: "Invoicing", icon: DollarSign, adminOnly: true },
  { label: "Labor Report", href: "/labor-report", icon: Tag, adminOnly: true },
  { href: "/users", label: "User Management", icon: UserCog, adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="size-7 md:size-8 text-primary flex-shrink-0" />
          <span className="text-base md:text-lg font-semibold text-sidebar-foreground truncate">
            FieldTack WA
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarMenu>
          {visibleMenuItems.map((item) => (
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
            <SidebarMenuButton
              tooltip="Support"
              className="px-3 py-2"
              asChild
              isActive={pathname === "/support"}
            >
              <Link href="/support">
                <LifeBuoy className="flex-shrink-0" />
                <span className="truncate">Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                className="px-3 py-2"
                asChild
                isActive={pathname === "/settings"}
              >
                <Link href="/settings">
                  <Settings className="flex-shrink-0" />
                  <span className="truncate">Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

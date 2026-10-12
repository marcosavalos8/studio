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
  Calculator,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
};

// Single source of truth for the app's pages: the sidebar renders this list,
// and the header search also matches typed text against it to jump straight
// to a page (e.g. typing "time tracking" navigates there) instead of only
// searching text on the current page.
export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/time-tracking", label: "Time Tracking", icon: QrCode, adminOnly: false },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { href: "/clients", label: "Clients", icon: Briefcase, adminOnly: true },
  { href: "/tasks", label: "Tasks", icon: ClipboardList, adminOnly: false },
  { href: "/payroll", label: "Payroll", icon: FileText, adminOnly: true },
  { href: "/invoicing", label: "Invoicing", icon: DollarSign, adminOnly: true },
  { href: "/labor-report", label: "Labor Report", icon: Tag, adminOnly: true },
  { href: "/accounting-center", label: "Accounting Center", icon: Calculator, adminOnly: true },
  { href: "/users", label: "User Management", icon: UserCog, adminOnly: true },
  { href: "/support", label: "Support", icon: LifeBuoy, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

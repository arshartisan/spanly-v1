import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Link2,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Server,
  Settings,
  Users,
} from "lucide-react";
import type { NavSection } from "@/lib/nav";

// Admin sidebar nav (doc 15), reusing the customer NavItem/NavSection types.
// Only `/admin` has a real page in Phase A; later phases fill the placeholders.
export const ADMIN_NAV: NavSection[] = [
  {
    heading: "Overview",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    heading: "People",
    items: [{ label: "Users", href: "/admin/users", icon: Users }],
  },
  {
    heading: "Revenue",
    items: [
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
      { label: "Refunds", href: "/admin/refunds", icon: RotateCcw },
      { label: "Payments", href: "/admin/payments", icon: ReceiptText },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Content", href: "/admin/content", icon: FileText },
      { label: "Connections", href: "/admin/connections", icon: Link2 },
    ],
  },
  {
    heading: "Platform",
    items: [
      { label: "System", href: "/admin/system", icon: Server },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Audit log", href: "/admin/audit", icon: ScrollText },
    ],
  },
];

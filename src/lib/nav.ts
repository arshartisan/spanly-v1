import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Link2,
  ListChecks,
  PenSquare,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";

// Sidebar nav map (doc 04). `soon` items render disabled with a "Soon" tag.
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Create",
    items: [
      { label: "Create post", href: "/create/text", icon: PenSquare },
      { label: "Content Studio", href: "/studio", icon: Sparkles, soon: true },
    ],
  },
  {
    heading: "Posts",
    items: [
      { label: "All Posts", href: "/posts/all", icon: FileText },
      { label: "Scheduled", href: "/posts/scheduled", icon: Send },
      { label: "Posted", href: "/posts/posted", icon: BarChart3 },
      { label: "Drafts", href: "/posts/drafts", icon: FileText },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "Connections", href: "/connections", icon: Link2 },
      { label: "Queue", href: "/settings/queue", icon: ListChecks },
    ],
  },
  {
    heading: "Configuration",
    items: [
      { label: "Settings", href: "/settings/general", icon: Settings },
      { label: "Billing", href: "/settings/billing", icon: LayoutDashboard },
      { label: "Plans", href: "/settings/plans", icon: BarChart3 },
    ],
  },
];

export const DASHBOARD_NAV: NavItem = {
  label: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { ADMIN_NAV } from "@/lib/admin-nav";
import type { NavItem } from "@/lib/nav";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { ThemeToggleRow } from "@/components/shell/ThemeToggleRow";

interface AdminSidebarProps {
  user: { displayName: string; email: string; avatarUrl?: string | null };
  planLabel: string;
}

// Mirrors the customer NavLink look + active state (see shell/Sidebar.tsx) so the
// admin surface feels like the same app. Kept local to the admin shell.
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "press group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all",
        active
          ? "bg-primary/15 font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
          : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className={cn("h-4 w-4", active && "text-primary")} />
      {item.label}
    </Link>
  );
}

export function AdminSidebar({ user, planLabel }: AdminSidebarProps) {
  const pathname = usePathname();
  // `/admin` is an exact match (so it doesn't stay lit on every sub-route);
  // sub-sections use prefix matching.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="glass-panel flex h-screen w-[230px] shrink-0 flex-col border-r border-border/60">
      <div className="flex flex-col gap-3 p-3">
        <Link
          href="/admin"
          aria-label="Spanlyfy Admin - go to admin home"
          className="press flex items-center gap-2 px-1.5 pt-1"
        >
          <Logo className="h-7" />
          <span className="glow-primary rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]">
            Admin
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="press flex items-center gap-2 rounded-xl border border-border/60 bg-foreground/5 px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit to app
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Admin">
        {ADMIN_NAV.map((section) => (
          <div key={section.heading} className="mt-4 first:mt-1">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {section.heading}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <ThemeToggleRow />
        <AccountMenu
          displayName={user.displayName}
          email={user.email}
          planLabel={planLabel}
          avatarUrl={user.avatarUrl}
        />
      </div>
    </aside>
  );
}

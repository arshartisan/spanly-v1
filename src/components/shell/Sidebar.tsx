"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV, NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CreatePostButton } from "./CreatePostButton";
import { AccountMenu } from "./AccountMenu";

interface SidebarProps {
  user: { displayName: string; email: string; avatarUrl?: string | null };
  planLabel: string;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <span className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/60">
        <Icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-foreground/80 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

export function Sidebar({ user, planLabel }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex h-screen w-[230px] shrink-0 flex-col border-r border-border bg-background">
      <div className="flex flex-col gap-3 p-3">
        <Link href="/dashboard" className="flex items-center gap-2 px-1.5 pt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">Spanly</span>
        </Link>
        <WorkspaceSwitcher />
        <CreatePostButton />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-1">
          <NavLink item={DASHBOARD_NAV} active={isActive(DASHBOARD_NAV.href)} />
        </div>
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mt-4">
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

      <div className="border-t border-border p-2">
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

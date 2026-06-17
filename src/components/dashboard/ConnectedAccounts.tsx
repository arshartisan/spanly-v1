import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { type PlatformKey } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export interface DashboardAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: "active" | "expired" | "error";
}

const STATUS: Record<
  DashboardAccount["status"],
  { dot: string; label: string }
> = {
  active: { dot: "bg-emerald-500", label: "Active" },
  expired: { dot: "bg-amber-500", label: "Needs reconnect" },
  error: { dot: "bg-red-500", label: "Connection error" },
};

/**
 * Dashboard "Connected accounts" panel: a preview of the live social accounts publishing from
 * this workspace, each shown with its avatar + brand badge and connection status. Links through
 * to /connections to manage. `total` may exceed the previewed list — the extra is surfaced as a
 * "view all" tile so the dashboard stays compact.
 */
export function ConnectedAccounts({
  accounts,
  total,
}: {
  accounts: DashboardAccount[];
  total: number;
}) {
  const remaining = total - accounts.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <CardDescription>
            {total} account{total === 1 ? "" : "s"} publishing from this workspace.
          </CardDescription>
        </div>
        <Link
          href="/connections"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Manage
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountItem key={account.id} account={account} />
          ))}
          {remaining > 0 && (
            <Link
              href="/connections"
              className="group flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              {remaining} more
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountItem({ account }: { account: DashboardAccount }) {
  const style = PLATFORM_STYLE[account.platform as PlatformKey];
  const Icon = style?.Icon;
  const status = STATUS[account.status];
  const initial = account.handle.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <Link
      href="/connections"
      className="group flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 border border-border/60">
          {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.handle} />}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        {Icon && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-background"
            style={{ backgroundColor: style.color }}
          >
            <Icon className="h-3 w-3" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {account.displayName ?? account.handle}
        </p>
        <p className="truncate text-xs text-muted-foreground">{account.handle}</p>
      </div>

      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)}
        title={status.label}
        aria-label={status.label}
      />
    </Link>
  );
}

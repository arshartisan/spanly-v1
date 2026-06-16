import type { AccountStatus, Platform, PostStatus, TargetStatus } from "@prisma/client";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { STATUS_META } from "@/lib/post-display";
import { cn } from "@/lib/utils";

// Client-safe display helpers for the admin content & connections surface (doc 18):
// platform chips (reusing the brand icons/colors from the customer connections UI),
// post-status badges (reusing STATUS_META so admin matches the customer app), plus
// per-target and account-status badges. Tokens are never rendered anywhere here.

const BADGE_BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium";

/** Small platform chip: brand icon in a colored dot + label. Reuses PLATFORM_STYLE. */
export function PlatformChip({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const style = PLATFORM_STYLE[platform];
  const Icon = style.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-foreground/[0.03] py-0.5 pl-1 pr-2 text-xs font-medium",
        className,
      )}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: style.color }}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      {style.label}
    </span>
  );
}

/** Post status badge using the shared customer-app STATUS_META palette. */
export function PostStatusBadge({
  status,
  className,
}: {
  status: PostStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={cn(BADGE_BASE, meta.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

const TARGET_STATUS_META: Record<TargetStatus, { label: string; badge: string; dot: string }> = {
  pending: { label: "Pending", badge: "bg-blue-500/10 text-blue-600", dot: "bg-blue-500" },
  publishing: { label: "Publishing", badge: "bg-indigo-500/10 text-indigo-600", dot: "bg-indigo-500" },
  success: { label: "Published", badge: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  failed: { label: "Failed", badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  canceled: { label: "Canceled", badge: "bg-slate-500/10 text-slate-600", dot: "bg-slate-500" },
};

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  pending: "Pending",
  publishing: "Publishing",
  success: "Published",
  failed: "Failed",
  canceled: "Canceled",
};

export function TargetStatusBadge({
  status,
  className,
}: {
  status: TargetStatus;
  className?: string;
}) {
  const meta = TARGET_STATUS_META[status];
  return (
    <span className={cn(BADGE_BASE, meta.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; badge: string }> = {
  active: {
    label: "Active",
    badge: "bg-status-posted/10 text-status-posted ring-1 ring-inset ring-status-posted/20",
  },
  expired: {
    label: "Expired",
    badge: "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20",
  },
  error: {
    label: "Error",
    badge: "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20",
  },
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  expired: "Expired",
  error: "Error",
};

export function AccountStatusBadge({
  status,
  className,
}: {
  status: AccountStatus;
  className?: string;
}) {
  const meta = ACCOUNT_STATUS_META[status];
  return <span className={cn(BADGE_BASE, meta.badge, className)}>{meta.label}</span>;
}

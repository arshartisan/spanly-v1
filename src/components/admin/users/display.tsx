import type { PlanKey, Role, SubscriptionStatus } from "@prisma/client";
import { PLANS } from "@/server/plans";
import { cn } from "@/lib/utils";

// Shared, client-safe display helpers for the admin user surface (doc 16): consistent
// role / plan / subscription-status badge styling reused by the list table and the
// detail header. Colors echo the existing status palette (status-*) + a red accent for
// suspended/destructive states.

export const ROLE_LABEL: Record<Role, string> = {
  user: "User",
  support: "Support",
  admin: "Admin",
  superadmin: "Superadmin",
};

const ROLE_BADGE: Record<Role, string> = {
  user: "bg-foreground/5 text-foreground/70 ring-1 ring-inset ring-border/60",
  support: "bg-status-scheduled/10 text-status-scheduled ring-1 ring-inset ring-status-scheduled/20",
  admin: "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25",
  superadmin: "bg-primary/20 text-primary ring-1 ring-inset ring-primary/40",
};

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  trialing: "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20",
  active: "bg-status-posted/10 text-status-posted ring-1 ring-inset ring-status-posted/20",
  past_due: "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20",
  paused: "bg-foreground/5 text-foreground/70 ring-1 ring-inset ring-border/60",
  canceled: "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20",
};

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  paused: "Paused",
  canceled: "Canceled",
};

const BADGE_BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium";

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return <span className={cn(BADGE_BASE, ROLE_BADGE[role], className)}>{ROLE_LABEL[role]}</span>;
}

export function PlanBadge({
  plan,
  status,
  className,
}: {
  plan: PlanKey | null | undefined;
  status?: SubscriptionStatus | null;
  className?: string;
}) {
  if (!plan) {
    return (
      <span
        className={cn(
          BADGE_BASE,
          "bg-foreground/5 text-muted-foreground ring-1 ring-inset ring-border/60",
          className,
        )}
      >
        No plan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          BADGE_BASE,
          "bg-foreground/5 text-foreground/80 ring-1 ring-inset ring-border/60",
          className,
        )}
      >
        {PLANS[plan].name}
      </span>
      {status ? <StatusBadge status={status} /> : null}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus;
  className?: string;
}) {
  return (
    <span className={cn(BADGE_BASE, STATUS_BADGE[status], className)}>{STATUS_LABEL[status]}</span>
  );
}

export function SuspendedPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        BADGE_BASE,
        "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/30",
        className,
      )}
    >
      Suspended
    </span>
  );
}

export function VerifiedPill({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        BADGE_BASE,
        verified
          ? "bg-status-posted/10 text-status-posted ring-1 ring-inset ring-status-posted/20"
          : "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20",
        className,
      )}
    >
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

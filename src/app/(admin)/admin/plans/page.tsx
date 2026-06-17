import { Infinity as InfinityIcon, Layers, Users } from "lucide-react";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { listPlansAdmin, type PlanAdminRow } from "@/server/admin/plans";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { PlanForm } from "@/components/admin/plans/PlanForm";
import { PlanActions } from "@/components/admin/plans/PlanActions";
import { cn } from "@/lib/utils";

// Admin plan-catalog manager (doc 17) - RSC. Replaces the old read-only catalog with a full
// editor: a "New plan" action + a table of every plan (incl. inactive) showing rank, key,
// pricing, account limit (-1 → "Unlimited"), feature count, public/active flags, and the
// live subscriber count. Each row has Edit (PlanForm) and, for superadmins, Delete
// (PlanActions). View is gated at `admin`; deleting is superadmin-only (the API enforces the
// same rule, plus a 409 guard against deleting a plan with subscribers or the last plan).

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const viewer = await requireStaff("admin");
  const canDelete = roleAtLeast(viewer.role, "superadmin");

  const plans = await listPlansAdmin();
  const nextRank = plans.reduce((max, p) => Math.max(max, p.rank), -1) + 1;
  const totalSubscribers = plans.reduce((sum, p) => sum + p.subscriberCount, 0);
  const activeCount = plans.filter((p) => p.active).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
            <p className="text-sm text-muted-foreground">
              The subscription catalog enforced across the platform. Edits take effect within
              seconds - no deploy required.
            </p>
          </div>
          <PlanForm mode="create" nextRank={nextRank} />
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="flex flex-wrap gap-3">
          <Stat icon={Layers} label="Plans" value={`${plans.length}`} sub={`${activeCount} active`} />
          <Stat icon={Users} label="Subscribers" value={`${totalSubscribers}`} sub="active · trialing · past due" />
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <Th className="w-12 text-center">Rank</Th>
                  <Th>Plan</Th>
                  <Th>Pricing</Th>
                  <Th>Accounts</Th>
                  <Th>Features</Th>
                  <Th>Visibility</Th>
                  <Th className="text-right">Subscribers</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <PlanRow
                    key={plan.key}
                    plan={plan}
                    canDelete={canDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

function PlanRow({
  plan,
  canDelete,
}: {
  plan: PlanAdminRow;
  canDelete: boolean;
}) {
  const unlimited = plan.accountLimit < 0;
  return (
    <tr
      className={cn(
        "group border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]",
        !plan.active && "opacity-55",
      )}
    >
      <Td className="text-center tabular-nums text-muted-foreground">{plan.rank}</Td>
      <Td>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-foreground">{plan.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{plan.key}</span>
          {plan.tagline ? (
            <span className="truncate text-xs text-muted-foreground">{plan.tagline}</span>
          ) : null}
        </div>
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        <span className="font-medium">${plan.monthly}</span>
        <span className="text-muted-foreground">/mo</span>
        <span className="text-muted-foreground"> · ${plan.yearly}/yr</span>
      </Td>
      <Td>
        {unlimited ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <InfinityIcon className="h-4 w-4" />
            Unlimited
          </span>
        ) : (
          <span className="font-medium tabular-nums">{plan.accountLimit}</span>
        )}
      </Td>
      <Td className="tabular-nums text-muted-foreground">
        {plan.features.length} feature{plan.features.length === 1 ? "" : "s"}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1.5">
          {plan.active ? (
            <Pill tone="posted">Active</Pill>
          ) : (
            <Pill tone="muted">Inactive</Pill>
          )}
          {plan.isPublic ? <Pill tone="primary">Public</Pill> : <Pill tone="muted">Hidden</Pill>}
        </div>
      </Td>
      <Td className="text-right tabular-nums font-medium">{plan.subscriberCount}</Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <PlanForm mode="edit" plan={plan} />
          {canDelete ? (
            <PlanActions
              planKey={plan.key}
              planName={plan.name}
              subscriberCount={plan.subscriberCount}
            />
          ) : null}
        </div>
      </Td>
    </tr>
  );
}

type PillTone = "posted" | "primary" | "muted";

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const styles: Record<PillTone, string> = {
    posted: "bg-status-posted/10 text-status-posted ring-status-posted/20",
    primary: "bg-primary/15 text-primary ring-primary/25",
    muted: "bg-foreground/5 text-muted-foreground ring-border/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold tabular-nums leading-tight">{value}</span>
        <span className="text-[11px] text-muted-foreground">
          {label} · {sub}
        </span>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

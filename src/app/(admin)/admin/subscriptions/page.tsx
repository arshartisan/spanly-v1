import Link from "next/link";
import { format } from "date-fns";
import {
  CreditCard,
  DollarSign,
  ExternalLink,
  Hourglass,
  AlertTriangle,
  Percent,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  listSubscriptions,
  type AdminSubscriptionListItem,
} from "@/server/admin/billing";
import { getBillingMetrics } from "@/server/admin/metrics";
import { subscriptionListQuerySchema } from "@/lib/schemas/admin-billing";
import { PLANS } from "@/server/plans";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { KpiCard } from "@/components/admin/KpiCard";
import { SubscriptionFilters } from "@/components/admin/billing/SubscriptionFilters";
import { PlanBadge, StatusBadge } from "@/components/admin/users/display";
import { formatCents, formatPercent } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { PlanKey } from "@prisma/client";

// Admin subscriptions oversight (doc 17) — RSC. A billing-metrics KPI strip + plan-mix
// breakdown, then a filterable subscriptions table sharing the users-table styling.

export const dynamic = "force-dynamic";

const STRIPE_BASE = "https://dashboard.stripe.com";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = subscriptionListQuerySchema.safeParse({
    status: first(raw.status),
    plan: first(raw.plan),
    interval: first(raw.interval),
  });
  const filter = parsed.success ? parsed.data : {};

  const [metrics, subscriptions] = await Promise.all([
    getBillingMetrics(),
    listSubscriptions(filter),
  ]);

  const planMixTotal =
    metrics.planMix.creator + metrics.planMix.growth + metrics.planMix.pro;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Revenue signals and the live subscription roster.
        </p>
      </Reveal>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delayChildren={0.08}>
        <StaggerItem className="h-full">
          <KpiCard
            icon={DollarSign}
            label="MRR"
            value={formatCents(metrics.mrrCents)}
            tone="primary"
            sub="Monthly recurring revenue"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={TrendingUp}
            label="ARPU"
            value={formatCents(metrics.arpuCents)}
            tone="posted"
            sub="Avg revenue per paying user"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard icon={CreditCard} label="Active" value={metrics.activeCount} tone="primary" />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard icon={Hourglass} label="Trialing" value={metrics.trialingCount} tone="draft" />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={AlertTriangle}
            label="Past due"
            value={metrics.pastDueCount}
            tone="failed"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={Percent}
            label="Churn (30d)"
            value={formatPercent(metrics.churn30d)}
            tone="draft"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={RotateCcw}
            label="Pending refunds"
            value={metrics.pendingRefunds}
            tone={metrics.pendingRefunds > 0 ? "failed" : "draft"}
            href="/admin/refunds"
          />
        </StaggerItem>
      </Stagger>

      <Reveal delay={0.18}>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Plan mix
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(PLANS) as PlanKey[]).map((key) => {
              const count = metrics.planMix[key];
              const pct = planMixTotal > 0 ? count / planMixTotal : 0;
              return (
                <div
                  key={key}
                  className="glass flex flex-col gap-1 rounded-xl border border-border/50 px-4 py-3"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{PLANS[key].name}</span>
                    <span className="text-2xl font-semibold tabular-nums">{count}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatPercent(pct)} of subs</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.24}>
        <SubscriptionFilters />
      </Reveal>

      <Reveal delay={0.3}>
        {subscriptions.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>User</Th>
                    <Th>Plan</Th>
                    <Th>Interval</Th>
                    <Th>Status</Th>
                    <Th>Trial ends</Th>
                    <Th>Period end</Th>
                    <Th>Add-on</Th>
                    <Th>Stripe</Th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <SubscriptionRow key={sub.id} sub={sub} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>
    </div>
  );
}

function SubscriptionRow({ sub }: { sub: AdminSubscriptionListItem }) {
  return (
    <tr className="group border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td>
        <Link
          href={`/admin/users/${sub.user.id}`}
          className="flex min-w-0 flex-col focus-visible:outline-none"
        >
          <span className="truncate font-medium text-foreground group-hover:underline">
            {sub.user.email}
          </span>
          {sub.user.displayName ? (
            <span className="truncate text-xs text-muted-foreground">{sub.user.displayName}</span>
          ) : null}
        </Link>
      </Td>
      <Td>
        <PlanBadge plan={sub.plan} />
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {sub.interval === "year" ? "Yearly" : "Monthly"}
      </Td>
      <Td>
        <StatusBadge status={sub.status} />
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(sub.trialEndsAt)}</Td>
      <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(sub.currentPeriodEnd)}</Td>
      <Td>
        {sub.apiAddonActive ? (
          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/25">
            API add-on
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </Td>
      <Td>
        {sub.stripeCustomerId ? (
          <a
            href={`${STRIPE_BASE}/customers/${sub.stripeCustomerId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
          >
            Customer
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </Td>
    </tr>
  );
}

function fmtDate(d: Date | null | undefined): string {
  return d ? format(new Date(d), "d MMM yyyy") : "—";
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Users className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No subscriptions match</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a different filter, or clear them to widen the results.
          </p>
        </div>
      </div>
    </Card>
  );
}

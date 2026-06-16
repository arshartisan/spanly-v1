import {
  AlertTriangle,
  CreditCard,
  Hourglass,
  Link2,
  RotateCcw,
  Send,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { getOverviewMetrics } from "@/server/admin/metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { KpiCard } from "@/components/admin/KpiCard";

// Admin Overview (doc 15). Real data only from getOverviewMetrics() — no invented
// fields. Mirrors the customer dashboard layout (max-w-7xl, Reveal/Stagger, KPI grid).
export default async function AdminOverviewPage() {
  const m = await getOverviewMetrics();

  const STATUS_BREAKDOWN: { key: keyof typeof m.subscriptions; label: string }[] = [
    { key: "trialing", label: "Trialing" },
    { key: "active", label: "Active" },
    { key: "past_due", label: "Past due" },
    { key: "paused", label: "Paused" },
    { key: "canceled", label: "Canceled" },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Live signals across users, revenue, and publishing.
        </p>
      </Reveal>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delayChildren={0.08}>
        <StaggerItem className="h-full">
          <KpiCard icon={Users} label="Total users" value={m.totalUsers} tone="primary" />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard icon={UserPlus} label="New users (30d)" value={m.newUsers30d} tone="scheduled" />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={TrendingUp}
            label="Active users (30d)"
            value={m.activeUsers30d}
            tone="posted"
            sub="Holding a live session"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={CreditCard}
            label="Active subscriptions"
            value={m.subscriptions.active}
            tone="primary"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={Hourglass}
            label="Trialing"
            value={m.subscriptions.trialing}
            tone="draft"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={AlertTriangle}
            label="Past due"
            value={m.subscriptions.past_due}
            tone="failed"
            href="/admin/subscriptions"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={Send}
            label="Posts published (7d)"
            value={m.postsPublished7d}
            tone="posted"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <KpiCard
            icon={Link2}
            label="Connected accounts"
            value={m.connectedAccounts}
            tone="primary"
          />
        </StaggerItem>
      </Stagger>

      <Reveal delay={0.24}>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Operational
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              icon={ShieldAlert}
              label="Suspended users"
              value={m.suspendedUsers}
              tone="failed"
              href="/admin/users"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Failed publishes"
              value={m.failedTargets}
              tone="failed"
              href="/admin/content"
            />
            <KpiCard
              icon={RotateCcw}
              label="Pending refunds"
              value={0}
              tone="draft"
              href="/admin/refunds"
              sub="No queue yet"
            />
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscriptions by status</CardTitle>
            <CardDescription>Current distribution across all accounts.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STATUS_BREAKDOWN.map(({ key, label }) => (
              <div
                key={key}
                className="glass flex flex-col gap-0.5 rounded-xl border border-border/50 px-4 py-3"
              >
                <span className="text-2xl font-semibold tabular-nums">{m.subscriptions[key]}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

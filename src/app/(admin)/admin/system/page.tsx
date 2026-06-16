import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Database,
  ListChecks,
  Plug,
  Server,
  Wrench,
} from "lucide-react";
import {
  getSystemHealth,
  getQueueCounts,
  getFailedPublishSummary,
  type SystemHealth,
  type QueueCountsResult,
  type FailedPublishSummary,
} from "@/server/admin/ops";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { HealthTile } from "@/components/admin/system/HealthTile";
import { QueueCard } from "@/components/admin/system/QueueCard";
import { RunMaintenance } from "@/components/admin/system/RunMaintenance";
import { cn } from "@/lib/utils";

// Admin System Health & Operations (doc 19) — RSC. Parallel-fetches health, queue counts, and
// the failed-publish summary, each isolated via Promise.allSettled so one failing probe can't
// blank the whole page. Redis-down degrades to red tiles / "queue backend unavailable" cards.

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const viewer = await requireStaff();
  const canControl = roleAtLeast(viewer.role, "admin");

  const [healthRes, queuesRes, failedRes] = await Promise.allSettled([
    getSystemHealth(),
    getQueueCounts(),
    getFailedPublishSummary(),
  ]);

  const health: SystemHealth | null = healthRes.status === "fulfilled" ? healthRes.value : null;
  const queues: QueueCountsResult | null =
    queuesRes.status === "fulfilled" ? queuesRes.value : null;
  const failed: FailedPublishSummary | null =
    failedRes.status === "fulfilled" ? failedRes.value : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground">
          Dependency health, the BullMQ queues, maintenance sweeps, and publish failures.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="flex flex-wrap gap-2">
          <TabLink href="/admin/system/jobs" icon={ListChecks} label="Jobs" />
          <TabLink href="/admin/system/events" icon={Activity} label="Event log" />
        </div>
      </Reveal>

      {/* ── Health ── */}
      <Reveal delay={0.1}>
        <SectionTitle>Health</SectionTitle>
      </Reveal>
      <Reveal delay={0.12}>
        {health ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HealthTile icon={Database} label="Database" health={health.db} />
            <HealthTile icon={Server} label="Redis" health={health.redis} />
            <InfoChipCard
              icon={Plug}
              label="Provider mode"
              value={health.providerMode}
            />
            <InfoChipCard
              icon={CreditCard}
              label="Billing mode"
              value={health.billingMode}
            />
          </div>
        ) : (
          <ErrorPanel>Could not read system health.</ErrorPanel>
        )}
      </Reveal>

      {/* ── Queues ── */}
      <Reveal delay={0.16}>
        <SectionTitle>Queues</SectionTitle>
      </Reveal>
      <Reveal delay={0.18}>
        {queues ? (
          <>
            {!queues.redisOk ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-status-failed/30 bg-status-failed/10 px-3 py-2 text-xs text-status-failed">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Redis is unreachable — queue counts are unavailable. Is Redis running?
              </div>
            ) : null}
            <Stagger className="grid gap-4 md:grid-cols-3" delayChildren={0.04}>
              {queues.queues.map((entry) => (
                <StaggerItem key={entry.name} className="h-full">
                  <QueueCard entry={entry} />
                </StaggerItem>
              ))}
            </Stagger>
          </>
        ) : (
          <ErrorPanel>Could not read queue counts.</ErrorPanel>
        )}
      </Reveal>

      {/* ── Maintenance (admin only) ── */}
      {canControl ? (
        <>
          <Reveal delay={0.22}>
            <SectionTitle>Maintenance</SectionTitle>
          </Reveal>
          <Reveal delay={0.24}>
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="h-4 w-4" />
                Enqueue a one-off sweep. The worker runs it on its next pass.
              </div>
              <RunMaintenance />
            </Card>
          </Reveal>
        </>
      ) : null}

      {/* ── Failed publishes ── */}
      <Reveal delay={0.28}>
        <SectionTitle>Failed publishes</SectionTitle>
      </Reveal>
      <Reveal delay={0.3}>
        {failed ? (
          failed.groups.length === 0 ? (
            <EmptyState />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {failed.total} failed {failed.total === 1 ? "target" : "targets"} grouped by
                  platform &amp; error
                </span>
                <Link
                  href="/admin/content?status=failed"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View in content
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <Th>Platform</Th>
                      <Th>Error class</Th>
                      <Th className="text-right">Count</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed.groups.map((g) => (
                      <tr
                        key={`${g.platform}-${g.errorClass}`}
                        className="border-b border-border/40 last:border-0 hover:bg-foreground/[0.03]"
                      >
                        <Td className="whitespace-nowrap font-medium capitalize">{g.platform}</Td>
                        <Td className="max-w-[420px]">
                          <span className="line-clamp-2 text-foreground/80">{g.errorClass}</span>
                        </Td>
                        <Td className="text-right">
                          <Link
                            href="/admin/content?status=failed"
                            className="inline-flex items-center justify-end gap-1 tabular-nums font-medium text-status-failed hover:underline"
                          >
                            {g.count}
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ) : (
          <ErrorPanel>Could not read the failed-publish summary.</ErrorPanel>
        )}
      </Reveal>
    </div>
  );
}

function TabLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="press glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
    </Link>
  );
}

function InfoChipCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-medium capitalize text-primary ring-1 ring-inset ring-primary/25">
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function ErrorPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-3 text-sm text-status-failed">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
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
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-posted/10 text-status-posted">
          <Activity className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No failed publishes</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Every target has published or is still pending. Nothing has exhausted its retries.
          </p>
        </div>
      </div>
    </Card>
  );
}

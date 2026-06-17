import "server-only";
import type { BillingInterval } from "@prisma/client";
import { prisma } from "@/server/db";
import { PLANS, type PlanKey } from "@/server/plans";

// Admin Overview KPIs (doc 15). One Promise.all of Prisma aggregates, mirroring the
// customer dashboard's metric pattern. All read-only; never logged.

export interface SubscriptionCounts {
  trialing: number;
  active: number;
  past_due: number;
  paused: number;
  canceled: number;
}

export interface OverviewMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers30d: number;
  subscriptions: SubscriptionCounts;
  suspendedUsers: number;
  postsPublished7d: number;
  failedTargets: number;
  connectedAccounts: number;
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const nowDate = new Date(now);

  const [
    totalUsers,
    newUsers7d,
    newUsers30d,
    activeUsers30d,
    subsByStatus,
    suspendedUsers,
    postsPublished7d,
    failedTargets,
    connectedAccounts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { createdAt: { gte: since30d } } }),
    // Active = distinct users holding a non-expired session (login-recency proxy).
    prisma.session
      .findMany({
        where: { expires: { gt: nowDate } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((rows) => rows.length),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.post.count({ where: { status: "posted", publishedAt: { gte: since7d } } }),
    prisma.postTarget.count({ where: { status: "failed" } }),
    prisma.socialAccount.count({ where: { disconnectedAt: null } }),
  ]);

  const subscriptions: SubscriptionCounts = {
    trialing: 0,
    active: 0,
    past_due: 0,
    paused: 0,
    canceled: 0,
  };
  for (const row of subsByStatus) {
    subscriptions[row.status] = row._count._all;
  }

  return {
    totalUsers,
    newUsers7d,
    newUsers30d,
    activeUsers30d,
    subscriptions,
    suspendedUsers,
    postsPublished7d,
    failedTargets,
    connectedAccounts,
  };
}

// ─────────────────────────── Billing metrics (doc 17) ───────────────────────────

/**
 * Monthly-equivalent revenue for one subscription, in cents. Monthly plans contribute
 * their monthly price; yearly plans contribute their annual price / 12 (rounded). Pure -
 * exported for unit tests.
 */
export function monthlyEquivalentCents(plan: PlanKey, interval: BillingInterval): number {
  const def = PLANS[plan];
  return interval === "year"
    ? Math.round((def.yearly * 100) / 12)
    : def.monthly * 100;
}

export interface BillingMetrics {
  mrrCents: number;
  arpuCents: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledCount: number;
  pausedCount: number;
  churn30d: number;
  planMix: Record<PlanKey, number>;
  pendingRefunds: number;
}

export async function getBillingMetrics(): Promise<BillingMetrics> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    payingSubs,
    subsByStatus,
    planMixRows,
    canceledIn30d,
    pendingRefunds,
  ] = await Promise.all([
    // MRR base: active + trialing subs (we treat trials as paying-equivalent for MRR).
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trialing"] } },
      select: { plan: true, interval: true },
    }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    // Plan mix among non-canceled subs.
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: { not: "canceled" } },
      _count: { _all: true },
    }),
    // Subs canceled (updated) in the last 30 days - proxy for churned this window.
    prisma.subscription.count({
      where: { status: "canceled", updatedAt: { gte: since30d } },
    }),
    prisma.refundRequest.count({ where: { status: "pending" } }),
  ]);

  const mrrCents = payingSubs.reduce(
    (sum, s) => sum + monthlyEquivalentCents(s.plan, s.interval),
    0,
  );
  const payingCount = payingSubs.length;
  const arpuCents = Math.round(mrrCents / Math.max(1, payingCount));

  const counts: Record<string, number> = {};
  for (const row of subsByStatus) counts[row.status] = row._count._all;
  const activeCount = counts.active ?? 0;
  const trialingCount = counts.trialing ?? 0;
  const pastDueCount = counts.past_due ?? 0;
  const canceledCount = counts.canceled ?? 0;
  const pausedCount = counts.paused ?? 0;

  // 30-day churn = canceled-in-window / (currently-active + canceled-in-window). The
  // denominator approximates the at-risk base over the window (those still active plus
  // those who left). Guarded against divide-by-zero via max(1, ...).
  const churn30d = canceledIn30d / Math.max(1, activeCount + canceledIn30d);

  const planMix: Record<PlanKey, number> = { creator: 0, growth: 0, pro: 0 };
  for (const row of planMixRows) planMix[row.plan] = row._count._all;

  return {
    mrrCents,
    arpuCents,
    activeCount,
    trialingCount,
    pastDueCount,
    canceledCount,
    pausedCount,
    churn30d,
    planMix,
    pendingRefunds,
  };
}

import "server-only";
import { prisma } from "@/server/db";

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

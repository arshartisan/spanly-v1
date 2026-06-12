import "server-only";
import { prisma } from "@/server/db";
import { accountLimit } from "@/server/plans";
import type { PlanKey } from "@prisma/client";
import type { PlatformKey } from "@/lib/platforms";

/**
 * Connection helpers (docs/implementation/05). "Active" = not soft-deleted
 * (disconnectedAt is null). The plan account-limit is enforced server-side on connect.
 */

export async function activeAccountCount(userId: string): Promise<number> {
  return prisma.socialAccount.count({ where: { userId, disconnectedAt: null } });
}

/** True if the user already has a live account for this platform (a reconnect, not a new seat). */
export async function hasActivePlatform(userId: string, platform: PlatformKey): Promise<boolean> {
  const n = await prisma.socialAccount.count({
    where: { userId, platform, disconnectedAt: null },
  });
  return n > 0;
}

/**
 * Whether the user may start a connect flow for `platform`. Reconnecting a platform the
 * user already has does not consume a new seat, so it's always allowed.
 */
export async function canConnect(
  userId: string,
  plan: PlanKey,
  platform: PlatformKey,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = accountLimit(plan);
  const used = await activeAccountCount(userId);
  if (used < limit) return { ok: true, used, limit };
  const reconnect = await hasActivePlatform(userId, platform);
  return { ok: reconnect, used, limit };
}

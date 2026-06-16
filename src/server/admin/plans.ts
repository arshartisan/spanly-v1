import "server-only";
import type { Plan } from "@prisma/client";
import { prisma } from "@/server/db";
import { AdminActionError } from "@/server/admin/errors";
import { invalidatePlanCache } from "@/server/plans";
import type { PlanCreateInput, PlanUpdateInput } from "@/lib/schemas/admin-plans";

// Admin plan-catalog CRUD service (DB-backed dynamic catalog). Pure-ish helpers with
// `AdminActionError` guards; the routes translate `.status` into the HTTP code, audit
// every mutation, and the catalog cache is invalidated after every write so changes land
// live. accountLimit stays as the -1 sentinel on the admin surface (JSON can't carry
// Infinity); the catalog layer (src/server/plans.ts) maps -1 ↔ Infinity for enforcement.

export { AdminActionError } from "@/server/admin/errors";

/** Subscription statuses that count as a "live" subscriber occupying a plan tier. */
const ACTIVE_SUB_STATUSES = ["active", "trialing", "past_due"] as const;

/** An admin-surface plan row: the full DB row plus the count of live subscribers on it. */
export type PlanAdminRow = Plan & { subscriberCount: number };

// ─────────────────────────── Reads ───────────────────────────

/**
 * Every plan (incl. inactive), ordered by `rank`, each with its live subscriber count
 * (active | trialing | past_due). The counts are fetched in ONE `groupBy` and mapped, so
 * this is a single extra query regardless of how many plans exist. accountLimit -1 is left
 * as -1 so the UI can render "Unlimited" (not converted to Infinity — JSON-unsafe).
 */
export async function listPlansAdmin(): Promise<PlanAdminRow[]> {
  const [plans, grouped] = await Promise.all([
    prisma.plan.findMany({ orderBy: { rank: "asc" } }),
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: { in: [...ACTIVE_SUB_STATUSES] } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(grouped.map((g) => [g.plan, g._count._all]));
  return plans.map((p) => ({ ...p, subscriberCount: counts.get(p.key) ?? 0 }));
}

/** The live subscriber count for a single plan key (active | trialing | past_due). */
async function subscriberCount(key: string): Promise<number> {
  return prisma.subscription.count({
    where: { plan: key, status: { in: [...ACTIVE_SUB_STATUSES] } },
  });
}

// ─────────────────────────── Mutations ───────────────────────────

/**
 * Create a plan tier. Guards: 409 if `key` already exists (the key is the @id, so a
 * collision would otherwise throw a raw Prisma error). The Zod layer already validated the
 * key slug shape + field ranges. Invalidates the catalog cache so the new tier is live.
 */
export async function createPlan(actorId: string, input: PlanCreateInput): Promise<Plan> {
  void actorId; // recorded by the route's audit log
  const existing = await prisma.plan.findUnique({ where: { key: input.key }, select: { key: true } });
  if (existing) {
    throw new AdminActionError(409, `A plan with the key "${input.key}" already exists.`);
  }

  const plan = await prisma.plan.create({
    data: {
      key: input.key,
      name: input.name,
      tagline: input.tagline,
      monthly: input.monthly,
      yearly: input.yearly,
      accountLimit: input.accountLimit,
      features: input.features,
      rank: input.rank,
      isPublic: input.isPublic,
      active: input.active,
    },
  });

  invalidatePlanCache();
  return plan;
}

/**
 * Patch a plan (only the provided fields). `key` is immutable — it's never accepted here,
 * since changing it would orphan every subscription on the old key. Guards: 404 if missing.
 * Invalidates the catalog cache. Returns the updated row (the route logs before/after).
 */
export async function updatePlan(
  actorId: string,
  key: string,
  patch: PlanUpdateInput,
): Promise<Plan> {
  void actorId; // recorded by the route's audit log
  const existing = await prisma.plan.findUnique({ where: { key } });
  if (!existing) throw new AdminActionError(404, "Plan not found.");

  const plan = await prisma.plan.update({ where: { key }, data: patch });

  invalidatePlanCache();
  return plan;
}

/**
 * Delete a plan tier. Guards (critical — must never silently break existing subscribers):
 *  - 404 if the plan does not exist;
 *  - 409 if ANY live subscriber is on it (guides the admin to set `active:false` instead);
 *  - 409 if it is the LAST active plan (never leave the catalog with zero active tiers).
 * Invalidates the catalog cache after a successful delete.
 */
export async function deletePlan(actorId: string, key: string): Promise<void> {
  void actorId; // recorded by the route's audit log
  const existing = await prisma.plan.findUnique({ where: { key } });
  if (!existing) throw new AdminActionError(404, "Plan not found.");

  const subscribers = await subscriberCount(key);
  if (subscribers > 0) {
    throw new AdminActionError(
      409,
      `${subscribers} subscriber${subscribers === 1 ? " is" : "s are"} on this plan — migrate or cancel them first, or set the plan inactive instead of deleting it.`,
    );
  }

  if (existing.active) {
    const otherActive = await prisma.plan.count({
      where: { active: true, key: { not: key } },
    });
    if (otherActive === 0) {
      throw new AdminActionError(
        409,
        "Cannot delete the last active plan — create or activate another plan first.",
      );
    }
  }

  await prisma.plan.delete({ where: { key } });
  invalidatePlanCache();
}

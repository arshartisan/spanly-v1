import "server-only";
import { prisma } from "@/server/db";
import {
  DEFAULT_PLAN_DEFS,
  type PlanDef,
  type PlanKey,
} from "@/lib/plan-defaults";

// Re-export the client-safe statics so existing `@/server/plans` importers keep working.
export { DEFAULT_PLAN_DEFS };
export type { PlanDef, PlanKey };

/**
 * Plan catalog + limit helpers (docs/implementation/10). Pricing per DECISIONS D-003.
 * Account limit is the primary billing gate (enforced server-side in connect flow).
 *
 * Two layers live here:
 *  1. Static DEFAULT_PLAN_DEFS + the synchronous exports (PLANS, PLAN_LIST, accountLimit,
 *     planAtLeast, requirePlan, isOverAccountLimit, planLabel). These are back-compat /
 *     fallback only - they keep the ~30 existing import sites compiling and serve as the
 *     fallback when the DB catalog is empty/unreachable. They do NOT read the live DB.
 *  2. Async DB-backed accessors (getPlanCatalog, getPlanMap, getPlan, getAccountLimit,
 *     getPlanAtLeast, requirePlanGate, getPlanLabel). These are the real source of truth -
 *     server-side enforcement should use these. They read the admin-editable Plan table,
 *     cached like flags.ts, and fall back to DEFAULT_PLAN_DEFS so the product never breaks.
 */

/** A sane default when a plan key is unknown to both the DB catalog and the defaults. */
const FALLBACK_ACCOUNT_LIMIT = DEFAULT_PLAN_DEFS[0].accountLimit; // Creator (15)

// ─────────────────────────── DB ↔ Infinity mapping ───────────────────────────

/** DB stores -1 for "unlimited"; the app uses Infinity. Pure (exported for tests). */
export function fromDbLimit(dbLimit: number): number {
  return dbLimit < 0 ? Infinity : dbLimit;
}

/** Inverse of fromDbLimit: Infinity → -1 for storage. Pure (exported for tests). */
export function toDbLimit(limit: number): number {
  return Number.isFinite(limit) ? limit : -1;
}

// ─────────────────────────── Static back-compat exports ───────────────────────────

/** Static defaults for back-compat/fallback; server enforcement should use the async get* accessors which read the live DB catalog. */
export const PLANS: Record<string, PlanDef> = Object.fromEntries(
  DEFAULT_PLAN_DEFS.map((p) => [p.key, p]),
);

/** Static defaults for back-compat/fallback; server enforcement should use the async get* accessors which read the live DB catalog. */
export const PLAN_LIST: PlanDef[] = DEFAULT_PLAN_DEFS;

/** Static back-compat/fallback. Prefer async getAccountLimit() for live enforcement. */
export function accountLimit(plan: PlanKey): number {
  return PLANS[plan]?.accountLimit ?? FALLBACK_ACCOUNT_LIMIT;
}

/**
 * Static back-compat/fallback rank lookup. Prefer async getPlanAtLeast() for live data.
 * Unknown plan ranks as the lowest tier (-1) so a stale/removed key never grants access.
 */
function rankOf(map: Record<string, PlanDef>, plan: PlanKey): number {
  return map[plan]?.rank ?? -1;
}

/** Static back-compat/fallback. True if `plan` is at least `min`. Prefer getPlanAtLeast(). */
export function planAtLeast(plan: PlanKey, min: PlanKey): boolean {
  return rankOf(PLANS, plan) >= rankOf(PLANS, min);
}

export type GateResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Static back-compat/fallback feature gate. Prefer async requirePlanGate() for live data.
 * Caller's subscription must be on `min` or higher and not dead. Never gate on the client.
 */
export function requirePlan(
  sub: { plan: PlanKey; status: string } | null,
  min: PlanKey,
): GateResult {
  if (!sub) return { ok: false, status: 402, error: "No active subscription." };
  if (sub.status === "canceled") return { ok: false, status: 402, error: "Subscription canceled." };
  if (!planAtLeast(sub.plan, min)) {
    return { ok: false, status: 402, error: `Requires the ${PLANS[min]?.name ?? min} plan or higher.` };
  }
  return { ok: true };
}

/**
 * Static back-compat/fallback. Whether a plan's account limit is exceeded by the current
 * active-account count. Prefer the async getAccountLimit() for live enforcement.
 */
export function isOverAccountLimit(plan: PlanKey, activeCount: number): boolean {
  return activeCount > accountLimit(plan);
}

/** Static back-compat/fallback sidebar/account-menu plan label. Prefer getPlanLabel(). */
export function planLabel(plan: PlanKey, status?: string): string {
  return labelFor(PLANS[plan]?.name ?? plan, status);
}

/** Shared label formatter (pure). */
function labelFor(name: string, status?: string): string {
  if (status === "trialing") return `${name} - Trial`;
  if (status === "past_due") return `${name} - Past due`;
  if (status === "canceled") return `${name} - Canceled`;
  return name;
}

// ─────────────────────────── DB-backed catalog (live source of truth) ───────────────────────────

const CACHE_TTL_MS = 20_000; // mirrors flags.ts - cheap gates, fast invalidation.

interface CachedCatalog {
  defs: PlanDef[];
  exp: number;
}

// Single-entry cache: the whole active catalog under one key.
let catalogCache: CachedCatalog | null = null;

/** Drop the cached catalog. Call on every Plan write (admin CRUD agent will use this). */
export function invalidatePlanCache(): void {
  catalogCache = null;
}

/** Map a Plan row (DB shape) to a PlanDef, converting the -1 sentinel to Infinity. */
function fromDbPlan(row: {
  key: string;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  accountLimit: number;
  features: string[];
  rank: number;
  isPublic: boolean;
  active: boolean;
}): PlanDef {
  return {
    key: row.key,
    name: row.name,
    monthly: row.monthly,
    yearly: row.yearly,
    tagline: row.tagline,
    accountLimit: fromDbLimit(row.accountLimit),
    features: row.features,
    rank: row.rank,
    isPublic: row.isPublic,
    active: row.active,
  };
}

/**
 * The active plan catalog, ordered by rank. Cached for CACHE_TTL_MS. Falls back to
 * DEFAULT_PLAN_DEFS if the DB is empty or unreachable - NEVER throws, so signup / connect /
 * publish keep working even when the catalog table is unavailable.
 */
export async function getPlanCatalog(): Promise<PlanDef[]> {
  const now = Date.now();
  if (catalogCache && catalogCache.exp > now) return catalogCache.defs;

  let defs: PlanDef[];
  try {
    const rows = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { rank: "asc" },
    });
    defs = rows.length > 0 ? rows.map(fromDbPlan) : DEFAULT_PLAN_DEFS;
  } catch {
    // DB unreachable - fall back to the built-in defaults so the product keeps working.
    defs = DEFAULT_PLAN_DEFS;
  }

  catalogCache = { defs, exp: now + CACHE_TTL_MS };
  return defs;
}

/** The active catalog keyed by plan key. */
export async function getPlanMap(): Promise<Record<string, PlanDef>> {
  const defs = await getPlanCatalog();
  return Object.fromEntries(defs.map((p) => [p.key, p]));
}

/** A single plan by key from the live catalog, or undefined if unknown/inactive. */
export async function getPlan(key: string): Promise<PlanDef | undefined> {
  const map = await getPlanMap();
  return map[key];
}

/**
 * The live account limit for a plan (Infinity = unlimited). An unknown plan key falls back
 * to the Creator-tier limit (FALLBACK_ACCOUNT_LIMIT) so a stale key never grants unlimited.
 */
export async function getAccountLimit(plan: PlanKey): Promise<number> {
  const def = await getPlan(plan);
  return def?.accountLimit ?? FALLBACK_ACCOUNT_LIMIT;
}

/** Live tier comparison using DB `rank`. Unknown plans rank as -1 (lowest). */
export async function getPlanAtLeast(plan: PlanKey, min: PlanKey): Promise<boolean> {
  const map = await getPlanMap();
  return rankOf(map, plan) >= rankOf(map, min);
}

/** Async (live-catalog) version of requirePlan: reads the catalog for name + rank. */
export async function requirePlanGate(
  sub: { plan: PlanKey; status: string } | null,
  min: PlanKey,
): Promise<GateResult> {
  if (!sub) return { ok: false, status: 402, error: "No active subscription." };
  if (sub.status === "canceled") return { ok: false, status: 402, error: "Subscription canceled." };
  const map = await getPlanMap();
  if (rankOf(map, sub.plan) < rankOf(map, min)) {
    return { ok: false, status: 402, error: `Requires the ${map[min]?.name ?? min} plan or higher.` };
  }
  return { ok: true };
}

/** Live (DB catalog) plan label, e.g. "Creator - Trial". */
export async function getPlanLabel(plan: PlanKey, status?: string): Promise<string> {
  const def = await getPlan(plan);
  return labelFor(def?.name ?? plan, status);
}

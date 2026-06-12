/**
 * Plan catalog + limit helpers (docs/implementation/10). Pricing per DECISIONS D-003.
 * Account limit is the primary billing gate (enforced server-side in connect flow).
 */
import type { PlanKey } from "@prisma/client";

export interface PlanDef {
  key: PlanKey;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  accountLimit: number; // Infinity for unlimited
  features: string[];
}

export const PLANS: Record<PlanKey, PlanDef> = {
  creator: {
    key: "creator",
    name: "Creator",
    monthly: 29,
    yearly: 319,
    tagline: "Best for growing creators",
    accountLimit: 15,
    features: [
      "Unlimited posts",
      "Schedule & queue",
      "Carousels",
      "Bulk tools",
      "Content studio",
      "Analytics (beta)",
      "API add-on available",
      "Human support",
    ],
  },
  growth: {
    key: "growth",
    name: "Growth",
    monthly: 49,
    yearly: 529,
    tagline: "Best for growing teams & agencies",
    accountLimit: 50,
    features: ["Everything in Creator", "Viral content tools", "Priority support"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthly: 99,
    yearly: 1069,
    tagline: "Best for scaling brands",
    accountLimit: Infinity,
    features: [
      "Everything in Growth",
      "Unlimited connected accounts",
      "Viral consulting",
      "Invite team members (later)",
    ],
  },
};

export function accountLimit(plan: PlanKey): number {
  return PLANS[plan].accountLimit;
}

// Plan ranking for tier comparisons (requirePlan, upgrade/downgrade copy).
const PLAN_RANK: Record<PlanKey, number> = { creator: 0, growth: 1, pro: 2 };

/** True if `plan` is at least `min` in the tier ordering (creator < growth < pro). */
export function planAtLeast(plan: PlanKey, min: PlanKey): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

export type GateResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Server-side feature gate: caller's subscription must be on `min` or higher and not in a
 * dead state. Used by handlers for Growth/Pro-only features (doc 10). Never gate on the client.
 */
export function requirePlan(
  sub: { plan: PlanKey; status: string } | null,
  min: PlanKey,
): GateResult {
  if (!sub) return { ok: false, status: 402, error: "No active subscription." };
  if (sub.status === "canceled") return { ok: false, status: 402, error: "Subscription canceled." };
  if (!planAtLeast(sub.plan, min)) {
    return { ok: false, status: 402, error: `Requires the ${PLANS[min].name} plan or higher.` };
  }
  return { ok: true };
}

/**
 * Whether a plan's account limit is exceeded by the current active-account count. On a
 * downgrade (e.g. Pro→Creator with 20 accounts) existing accounts are kept but flagged
 * over-limit; new connects are blocked by the connect flow (doc 05 / D-015).
 */
export function isOverAccountLimit(plan: PlanKey, activeCount: number): boolean {
  return activeCount > accountLimit(plan);
}

/** Sidebar/account-menu plan label, e.g. "Creator — Trial" or "Pro" (doc 04). */
export function planLabel(plan: PlanKey, status?: string): string {
  const name = PLANS[plan].name;
  if (status === "trialing") return `${name} — Trial`;
  if (status === "past_due") return `${name} — Past due`;
  if (status === "canceled") return `${name} — Canceled`;
  return name;
}

export const PLAN_LIST: PlanDef[] = [PLANS.creator, PLANS.growth, PLANS.pro];

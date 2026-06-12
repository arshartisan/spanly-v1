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

export const PLAN_LIST: PlanDef[] = [PLANS.creator, PLANS.growth, PLANS.pro];

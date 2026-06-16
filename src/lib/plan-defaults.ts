// Client-safe plan catalog defaults — NO `server-only`, NO prisma, so this is importable
// from client components AND the server. It is the single source of the static fallback
// catalog used by the server's DB-backed catalog (`src/server/plans.ts`) and by client
// display/filter components until the live catalog is passed down as props.
//
// `PlanKey` is a dynamic string since the Prisma `PlanKey` enum was dropped (admins can
// add/remove tiers). These defaults seed the `Plan` table and are the fallback whenever the
// DB catalog is empty or unreachable.

export type PlanKey = string;

export interface PlanDef {
  key: string;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  accountLimit: number; // Infinity for unlimited
  features: string[];
  rank: number; // tier ordering + comparison (creator 0 < growth 1 < pro 2)
  isPublic: boolean; // shown on pricing/checkout
  active: boolean;
}

/** The built-in default tiers. Mirrors the original hardcoded catalog. */
export const DEFAULT_PLAN_DEFS: PlanDef[] = [
  {
    key: "creator",
    name: "Creator",
    monthly: 29,
    yearly: 319,
    tagline: "Best for growing creators",
    accountLimit: 15,
    rank: 0,
    isPublic: true,
    active: true,
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
  {
    key: "growth",
    name: "Growth",
    monthly: 49,
    yearly: 529,
    tagline: "Best for growing teams & agencies",
    accountLimit: 50,
    rank: 1,
    isPublic: true,
    active: true,
    features: ["Everything in Creator", "Viral content tools", "Priority support"],
  },
  {
    key: "pro",
    name: "Pro",
    monthly: 99,
    yearly: 1069,
    tagline: "Best for scaling brands",
    accountLimit: Infinity,
    rank: 2,
    isPublic: true,
    active: true,
    features: [
      "Everything in Growth",
      "Unlimited connected accounts",
      "Viral consulting",
      "Invite team members (later)",
    ],
  },
];

/** Default catalog as a key→def map. */
export const DEFAULT_PLANS: Record<string, PlanDef> = Object.fromEntries(
  DEFAULT_PLAN_DEFS.map((p) => [p.key, p]),
);

/** Default plan keys, in rank order. */
export const DEFAULT_PLAN_KEYS: string[] = DEFAULT_PLAN_DEFS.map((p) => p.key);

/** Client-safe label formatter (pure). Falls back to the raw key for unknown/custom plans. */
export function defaultPlanLabel(plan: PlanKey, status?: string): string {
  const name = DEFAULT_PLANS[plan]?.name ?? plan;
  if (status === "trialing") return `${name} — Trial`;
  if (status === "past_due") return `${name} — Past due`;
  if (status === "canceled") return `${name} — Canceled`;
  return name;
}

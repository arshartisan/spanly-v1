import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PlanKey } from "@prisma/client";

/**
 * Stripe wiring + env price mapping (docs/implementation/10).
 *
 * Mirrors the MockProvider pattern used for OAuth/publishing: BILLING_MODE gates whether we
 * talk to real Stripe ("live") or run an internal stand-in ("mock", the default). Mock mode
 * lets the entire billing flow — checkout → trial → portal → cancel → addon — be built and
 * verified with no Stripe account or Price IDs (still a pending human-action item). The live
 * code path is wired and ready; it just needs STRIPE_* env values to switch on.
 */

export type BillingMode = "mock" | "live";

export const BILLING_MODE: BillingMode =
  process.env.BILLING_MODE === "live" ? "live" : "mock";

export function isLiveBilling(): boolean {
  return BILLING_MODE === "live";
}

/** App origin for building absolute redirect URLs (Checkout success/cancel, portal return). */
export function appUrl(path = ""): string {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

// ─────────────────────────── Price ↔ plan/interval map ───────────────────────────
// Env holds one Stripe Price ID per (plan, interval). We keep both directions: forward for
// Checkout (plan+interval → price), reverse for the webhook (Stripe price → our plan).

const PRICE_ENV: Record<PlanKey, Record<BillingInterval, string | undefined>> = {
  creator: {
    month: process.env.STRIPE_PRICE_CREATOR_MONTH,
    year: process.env.STRIPE_PRICE_CREATOR_YEAR,
  },
  growth: {
    month: process.env.STRIPE_PRICE_GROWTH_MONTH,
    year: process.env.STRIPE_PRICE_GROWTH_YEAR,
  },
  pro: {
    month: process.env.STRIPE_PRICE_PRO_MONTH,
    year: process.env.STRIPE_PRICE_PRO_YEAR,
  },
};

export const API_ADDON_PRICE = process.env.STRIPE_PRICE_API_ADDON;

/** Stripe Price ID for a (plan, interval). Throws in live mode if unconfigured. */
export function priceIdFor(plan: PlanKey, interval: BillingInterval): string {
  const id = PRICE_ENV[plan][interval];
  if (!id) {
    if (isLiveBilling()) {
      throw new Error(`Missing Stripe price for ${plan}/${interval} (set STRIPE_PRICE_* env).`);
    }
    // Mock mode: synthesize a deterministic placeholder so callers still get a value.
    return `mock_price_${plan}_${interval}`;
  }
  return id;
}

/** Reverse lookup: Stripe Price ID → {plan, interval}, or null if unknown. */
export function planFromPriceId(priceId: string): { plan: PlanKey; interval: BillingInterval } | null {
  for (const plan of Object.keys(PRICE_ENV) as PlanKey[]) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (PRICE_ENV[plan][interval] === priceId) return { plan, interval };
    }
  }
  // Tolerate mock placeholders so the same sync path works in either mode.
  const m = /^mock_price_(creator|growth|pro)_(month|year)$/.exec(priceId);
  if (m) return { plan: m[1] as PlanKey, interval: m[2] as BillingInterval };
  return null;
}

// ─────────────────────────── Live Stripe client (lazy) ───────────────────────────

let _stripe: Stripe | null = null;

/** The Stripe SDK client. Only valid in live mode (throws if the secret key is absent). */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set (cannot use live billing).");
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}

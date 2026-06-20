import "server-only";
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { BillingInterval } from "@prisma/client";
import type { PlanKey } from "@/server/plans";
import { isLiveBilling } from "@/server/billing-config";

/**
 * Polar.sh wiring + env product mapping (docs/implementation/10). Replaces the old PayPal
 * client. Polar ships a real TypeScript SDK, so this is a thin wrapper: a memoized client
 * (the SDK handles auth from the access token), the (plan, interval) → Polar product-id map,
 * and Standard-Webhooks signature validation.
 *
 * Only meaningful in live mode (BILLING_MODE=live). Mock mode never calls these - see
 * src/server/billing.ts for the mock stand-ins.
 */

// ─────────────────────────── SDK client (memoized) ───────────────────────────

let _client: Polar | null = null;

/** Memoized Polar SDK client. Throws in live mode if the access token is unset. */
export function polar(): Polar {
  if (_client) return _client;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not set (cannot use live billing).");
  }
  const server = process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
  _client = new Polar({ accessToken, server });
  return _client;
}

// ─────────────────────────── Product-id ↔ plan/interval map ───────────────────────────
// Env holds one Polar product id per (plan, interval). Forward for checkout
// (plan+interval → product id), reverse for the webhook (Polar product id → our plan).

const PRODUCT_ENV: Record<PlanKey, Record<BillingInterval, string | undefined>> = {
  creator: {
    month: process.env.POLAR_PRODUCT_CREATOR_MONTH,
    year: process.env.POLAR_PRODUCT_CREATOR_YEAR,
  },
  growth: {
    month: process.env.POLAR_PRODUCT_GROWTH_MONTH,
    year: process.env.POLAR_PRODUCT_GROWTH_YEAR,
  },
  pro: {
    month: process.env.POLAR_PRODUCT_PRO_MONTH,
    year: process.env.POLAR_PRODUCT_PRO_YEAR,
  },
};

/** Product id for the standalone $5/mo API add-on subscription. */
export const API_ADDON_PRODUCT = process.env.POLAR_PRODUCT_API_ADDON;

/** Polar product id for a (plan, interval). Throws in live mode if unconfigured. */
export function productIdFor(plan: PlanKey, interval: BillingInterval): string {
  const id = PRODUCT_ENV[plan][interval];
  if (!id) {
    if (isLiveBilling()) {
      throw new Error(`Missing Polar product for ${plan}/${interval} (set POLAR_PRODUCT_* env).`);
    }
    // Mock mode: synthesize a deterministic placeholder so callers still get a value.
    return `mock_product_${plan}_${interval}`;
  }
  return id;
}

/** Reverse lookup: Polar product id → {plan, interval}, or null if unknown. */
export function planFromProductId(
  productId: string,
): { plan: PlanKey; interval: BillingInterval } | null {
  for (const plan of Object.keys(PRODUCT_ENV) as PlanKey[]) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (PRODUCT_ENV[plan][interval] === productId) return { plan, interval };
    }
  }
  // Tolerate mock placeholders so the same sync path works in either mode.
  const m = /^mock_product_(creator|growth|pro)_(month|year)$/.exec(productId);
  if (m) return { plan: m[1] as PlanKey, interval: m[2] as BillingInterval };
  return null;
}

/** True if the product id is the API add-on product. */
export function isAddonProduct(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return productId === API_ADDON_PRODUCT || productId === "mock_product_api_addon";
}

// ─────────────────────────── Webhook signature verification ───────────────────────────

/**
 * The validated webhook payload union. Polar follows the Standard Webhooks spec, so this is a
 * local HMAC check (no network round-trip, unlike PayPal). `validateEvent` returns a typed,
 * discriminated payload keyed by `type`.
 */
export type PolarWebhookEvent = ReturnType<typeof validateEvent>;

/**
 * Verify + parse an inbound Polar webhook. Needs the raw request body, the request headers
 * (the Standard-Webhooks signature headers), and POLAR_WEBHOOK_SECRET. Throws
 * WebhookVerificationError on a bad signature so the route can reject with 400.
 */
export function verifyWebhook(rawBody: string, headers: Headers): PolarWebhookEvent {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) throw new WebhookVerificationError("POLAR_WEBHOOK_SECRET is not set.");
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  return validateEvent(rawBody, headerObj, secret);
}

export { WebhookVerificationError };

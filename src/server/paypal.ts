import "server-only";
import type { BillingInterval } from "@prisma/client";
import type { PlanKey } from "@/server/plans";
import { isLiveBilling } from "@/server/billing-config";

/**
 * PayPal REST wiring + env plan mapping (docs/implementation/10). Replaces the old Stripe
 * client. PayPal has no SDK that covers the Subscriptions API well, so this is a thin
 * fetch-based client: OAuth2 client-credentials token (cached), a JSON fetch wrapper, the
 * (plan, interval) → PayPal billing-plan-id map, and webhook signature verification.
 *
 * Only meaningful in live mode (BILLING_MODE=live). Mock mode never calls these — see
 * src/server/billing.ts for the mock stand-ins.
 */

/** API host by environment. Sandbox unless PAYPAL_ENV=live. */
export function paypalBase(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// ─────────────────────────── Plan-id ↔ plan/interval map ───────────────────────────
// Env holds one PayPal billing-plan id per (plan, interval). Forward for checkout
// (plan+interval → plan id), reverse for the webhook (PayPal plan id → our plan).

const PLAN_ENV: Record<PlanKey, Record<BillingInterval, string | undefined>> = {
  creator: {
    month: process.env.PAYPAL_PLAN_CREATOR_MONTH,
    year: process.env.PAYPAL_PLAN_CREATOR_YEAR,
  },
  growth: {
    month: process.env.PAYPAL_PLAN_GROWTH_MONTH,
    year: process.env.PAYPAL_PLAN_GROWTH_YEAR,
  },
  pro: {
    month: process.env.PAYPAL_PLAN_PRO_MONTH,
    year: process.env.PAYPAL_PLAN_PRO_YEAR,
  },
};

/** Billing-plan id for the standalone $5/mo API add-on subscription. */
export const API_ADDON_PLAN = process.env.PAYPAL_PLAN_API_ADDON;

/** PayPal billing-plan id for a (plan, interval). Throws in live mode if unconfigured. */
export function planIdFor(plan: PlanKey, interval: BillingInterval): string {
  const id = PLAN_ENV[plan][interval];
  if (!id) {
    if (isLiveBilling()) {
      throw new Error(`Missing PayPal plan for ${plan}/${interval} (set PAYPAL_PLAN_* env).`);
    }
    // Mock mode: synthesize a deterministic placeholder so callers still get a value.
    return `mock_plan_${plan}_${interval}`;
  }
  return id;
}

/** Reverse lookup: PayPal plan id → {plan, interval}, or null if unknown. */
export function planFromPlanId(
  planId: string,
): { plan: PlanKey; interval: BillingInterval } | null {
  for (const plan of Object.keys(PLAN_ENV) as PlanKey[]) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (PLAN_ENV[plan][interval] === planId) return { plan, interval };
    }
  }
  // Tolerate mock placeholders so the same sync path works in either mode.
  const m = /^mock_plan_(creator|growth|pro)_(month|year)$/.exec(planId);
  if (m) return { plan: m[1] as PlanKey, interval: m[2] as BillingInterval };
  return null;
}

// ─────────────────────────── OAuth2 access token (cached) ───────────────────────────

let _token: { value: string; expiresAt: number } | null = null;

/** Cached client-credentials bearer token. Refreshes ~1 min before expiry. */
export async function getAccessToken(): Promise<string> {
  if (_token && _token.expiresAt > Date.now()) return _token.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set (cannot use live billing).");
  }

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal token request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _token = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return _token.value;
}

// ─────────────────────────── JSON fetch wrapper ───────────────────────────

/**
 * Authenticated JSON request to the PayPal REST API. Injects the bearer token + JSON headers
 * and throws on non-2xx with the PayPal error body. Returns the parsed JSON (or {} for 204).
 */
export async function paypalFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`PayPal ${init.method ?? "GET"} ${path} failed (${res.status}): ${await res.text()}`);
  }
  if (res.status === 204) return {} as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

// ─────────────────────────── Webhook signature verification ───────────────────────────

/**
 * Verify an inbound webhook via PayPal's verify-webhook-signature API (PayPal signs with a
 * cert, not an HMAC of the body, so verification is a round-trip call). Needs the raw
 * `paypal-*` request headers + our configured PAYPAL_WEBHOOK_ID. Returns false on any error
 * so the route can reject. `event` must be the parsed webhook body.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  event: unknown,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const required = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (Object.values(required).some((v) => !v)) return false;

  try {
    const data = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({ ...required, webhook_id: webhookId, webhook_event: event }),
      },
    );
    return data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

import "server-only";
import type { BillingInterval, Subscription } from "@prisma/client";
import { prisma } from "@/server/db";
import { mailer } from "@/server/mailer";
import { getPlanMap } from "@/server/plans";
import type { PlanKey } from "@/server/plans";
import { getRefundWindowDays, getTrialDays } from "@/server/settings/config";
import { appUrl, isLiveBilling } from "@/server/billing-config";
import {
  API_ADDON_PLAN,
  paypalFetch,
  planFromPlanId,
  planIdFor,
} from "@/server/paypal";

/**
 * Billing service (docs/implementation/10). One module both modes share: the live path talks
 * to PayPal's Subscriptions API, the mock path drives the same `Subscription` upsert logic via
 * internal pages. In live mode PayPal is the source of truth (webhook-driven); mock mode writes
 * directly.
 *
 * PayPal differences vs the old Stripe wiring: subscriptions return an approval URL the user
 * must visit (no hosted Checkout); there is no Customer object (identity is carried by
 * `custom_id = userId`); the trial lives on the billing plan, not the create call; and the
 * $5/mo API add-on is its own subscription (PayPal can't attach arbitrary items to a sub).
 */

export type CheckoutResult = { url: string };

/** A PayPal billing-subscription resource (the subset we read). */
export interface PaypalSubscription {
  id: string;
  plan_id?: string;
  status: string;
  custom_id?: string;
  subscriber?: { payer_id?: string; email_address?: string };
  billing_info?: {
    next_billing_time?: string;
    cycle_executions?: Array<{ tenure_type: string; cycles_remaining: number }>;
  };
  links?: Array<{ rel: string; href: string }>;
}

/** Extract the approval URL the subscriber must visit from a PayPal subscription's HATEOAS links. */
function approveLink(links?: Array<{ rel: string; href: string }>): string | undefined {
  return links?.find((l) => l.rel === "approve")?.href;
}

/** GET a PayPal subscription by id (used by the webhook + add-on flows). Live mode only. */
export async function getPaypalSubscription(id: string): Promise<PaypalSubscription> {
  return paypalFetch<PaypalSubscription>(`/v1/billing/subscriptions/${id}`);
}

/**
 * Start a subscription checkout for (plan, interval).
 * - live: create a PayPal subscription and return its approval URL. No local row is written —
 *   the BILLING.SUBSCRIPTION.ACTIVATED webhook creates/updates it (PayPal is the truth).
 * - mock: redirect to the internal mock checkout page (which completes via /api/billing/mock).
 */
export async function createCheckout(
  userId: string,
  email: string,
  plan: PlanKey,
  interval: BillingInterval,
): Promise<CheckoutResult> {
  if (!isLiveBilling()) {
    const qs = new URLSearchParams({ plan, interval });
    return { url: `/billing/mock/checkout?${qs.toString()}` };
  }

  const created = await paypalFetch<PaypalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planIdFor(plan, interval),
      custom_id: userId,
      subscriber: { email_address: email },
      application_context: {
        brand_name: "Spanly",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: appUrl("/settings/billing?subscribed=1"),
        cancel_url: appUrl("/settings/plans?canceled=1"),
      },
    }),
  });
  const url = approveLink(created.links);
  if (!url) throw new Error("PayPal did not return an approval URL.");
  return { url };
}

/**
 * Cancel the user's subscription (PayPal has no billing portal). Live: cancel via the PayPal
 * API; both modes flip the local row to `canceled` (the webhook also confirms it in live).
 */
export async function cancelSubscription(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) throw new Error("No subscription found.");

  if (isLiveBilling()) {
    if (!sub.providerSubId) throw new Error("No active subscription to cancel.");
    await paypalFetch(`/v1/billing/subscriptions/${sub.providerSubId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Customer requested cancellation" }),
    });
  }
  await prisma.subscription.update({ where: { userId }, data: { status: "canceled" } });
}

export type AddonResult = { enabled: boolean; url?: string };

/**
 * Enable/disable the $5/mo API add-on. In live mode the add-on is its own PayPal subscription:
 * enabling creates one and returns its approval URL (the webhook flips `apiAddonActive` true on
 * activation); disabling cancels it. Mock mode flips the flag directly.
 */
export async function toggleApiAddon(userId: string, enable: boolean): Promise<AddonResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) throw new Error("No active subscription to modify.");

  if (isLiveBilling()) {
    if (enable) {
      if (!API_ADDON_PLAN) throw new Error("PAYPAL_PLAN_API_ADDON is not configured.");
      const created = await paypalFetch<PaypalSubscription>("/v1/billing/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          plan_id: API_ADDON_PLAN,
          custom_id: `${userId}:addon`,
          application_context: {
            brand_name: "Spanly",
            user_action: "SUBSCRIBE_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: appUrl("/settings/billing?addon=1"),
            cancel_url: appUrl("/settings/billing"),
          },
        }),
      });
      await prisma.subscription.update({
        where: { userId },
        data: { providerAddonSubId: created.id },
      });
      const url = approveLink(created.links);
      if (!url) throw new Error("PayPal did not return an approval URL for the add-on.");
      // Not active yet — the webhook sets apiAddonActive=true once the add-on sub activates.
      return { enabled: false, url };
    }
    if (sub.providerAddonSubId) {
      await paypalFetch(`/v1/billing/subscriptions/${sub.providerAddonSubId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Add-on disabled" }),
      });
    }
    await prisma.subscription.update({
      where: { userId },
      data: { apiAddonActive: false, providerAddonSubId: null },
    });
    return { enabled: false };
  }

  // Mock mode: flip the flag directly.
  await prisma.subscription.update({ where: { userId }, data: { apiAddonActive: enable } });
  return { enabled: enable };
}

export type RefundResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Request a refund (D-016). Within the refund window we record the request + notify support;
 * outside it we deny. No automatic PayPal refund here — staff issue it from the admin queue.
 */
export async function requestRefund(userId: string, email: string): Promise<RefundResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { ok: false, message: "No subscription found." };

  // Approximate "last charge" as the start of the current period (trial start or renewal).
  const anchor = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd.getTime() - intervalMs(sub.interval))
    : sub.createdAt;
  const refundWindowDays = await getRefundWindowDays();
  const withinWindow = Date.now() - anchor.getTime() <= refundWindowDays * 86_400_000;
  if (!withinWindow) {
    return {
      ok: false,
      message: `Refund window has passed (${refundWindowDays}-day money-back guarantee).`,
    };
  }

  // In-policy: record an actionable refund request for the admin queue (doc 17). Don't
  // create a duplicate if one is already pending for this user — still return ok.
  const existingPending = await prisma.refundRequest.findFirst({
    where: { userId, status: "pending" },
    select: { id: true },
  });
  if (!existingPending) {
    const planMap = await getPlanMap();
    const plan = planMap[sub.plan];
    const amount = plan ? (sub.interval === "year" ? plan.yearly : plan.monthly) * 100 : 0;
    await prisma.refundRequest.create({
      data: {
        userId,
        subscriptionId: sub.id,
        amount,
        reason: "Customer requested refund",
        status: "pending",
      },
    });
  }

  await mailer.send({
    to: "support@spanly.app",
    subject: `Refund request — ${email}`,
    text: `User ${userId} (${email}) requested a refund on plan ${sub.plan}/${sub.interval}.`,
  });
  return { ok: true, message: "Refund request received — our team will process it within 2 business days." };
}

// ─────────────────────────── Subscription sync (shared) ───────────────────────────

export interface SyncInput {
  userId: string;
  plan: PlanKey;
  interval: BillingInterval;
  status: Subscription["status"];
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  providerCustomerId?: string | null;
  providerSubId?: string | null;
  providerAddonSubId?: string | null;
  apiAddonActive?: boolean;
}

/** Idempotent upsert of the local Subscription from a normalized state (webhook or mock). */
export async function syncSubscription(input: SyncInput): Promise<void> {
  const { userId, ...rest } = input;
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...stripScalars(rest) },
    update: stripScalars(rest),
  });
}

/** Mock-only: subscribe with a fresh trial (drives the same upsert the webhook would). */
export async function mockActivate(
  userId: string,
  plan: PlanKey,
  interval: BillingInterval,
): Promise<void> {
  const now = Date.now();
  const trialDays = await getTrialDays();
  await syncSubscription({
    userId,
    plan,
    interval,
    status: "trialing",
    trialEndsAt: new Date(now + trialDays * 86_400_000),
    currentPeriodEnd: new Date(now + intervalMs(interval)),
    providerCustomerId: `mock_payer_${userId.slice(0, 12)}`,
    providerSubId: `mock_sub_${userId.slice(0, 12)}`,
  });
}

// ─────────────────────────── PayPal webhook normalization ───────────────────────────

/** Map a PayPal subscription resource → our SyncInput (live mode webhook). */
export function fromPaypalSubscription(
  sub: PaypalSubscription,
  userId: string,
): SyncInput | null {
  const mapped = sub.plan_id ? planFromPlanId(sub.plan_id) : null;
  if (!mapped) return null;

  const trial = sub.billing_info?.cycle_executions?.find((c) => c.tenure_type === "TRIAL");
  const inTrial = !!trial && trial.cycles_remaining > 0;
  const nextBill = sub.billing_info?.next_billing_time
    ? new Date(sub.billing_info.next_billing_time)
    : null;

  let status = mapPaypalStatus(sub.status);
  if (status === "active" && inTrial) status = "trialing";

  return {
    userId,
    plan: mapped.plan,
    interval: mapped.interval,
    status,
    trialEndsAt: inTrial ? nextBill : null,
    currentPeriodEnd: nextBill,
    providerCustomerId: sub.subscriber?.payer_id ?? null,
    providerSubId: sub.id,
  };
}

/** Map a PayPal subscription status → our local enum. */
export function mapPaypalStatus(s: string): Subscription["status"] {
  switch (s) {
    case "ACTIVE":
      return "active";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "trialing"; // pending activation — treated as in-trial until ACTIVATED
    case "SUSPENDED":
      return "paused";
    default:
      return "canceled"; // CANCELLED | EXPIRED | anything unexpected
  }
}

// ─────────────────────────── helpers ───────────────────────────

function intervalMs(interval: BillingInterval): number {
  return (interval === "year" ? 365 : 30) * 86_400_000;
}

/** Drop undefined keys so a partial sync never overwrites existing columns with undefined. */
function stripScalars<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

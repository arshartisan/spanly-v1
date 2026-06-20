import "server-only";
import type { BillingInterval, Subscription } from "@prisma/client";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { prisma } from "@/server/db";
import { mailer } from "@/server/mailer";
import { getPlanMap } from "@/server/plans";
import type { PlanKey } from "@/server/plans";
import { getRefundWindowDays, getTrialDays } from "@/server/settings/config";
import { appUrl, isLiveBilling } from "@/server/billing-config";
import {
  API_ADDON_PRODUCT,
  isAddonProduct,
  planFromProductId,
  polar,
  productIdFor,
} from "@/server/polar";

/**
 * Billing service (docs/implementation/10). One module both modes share: the live path talks
 * to Polar.sh, the mock path drives the same `Subscription` upsert logic via internal pages.
 * In live mode Polar is the source of truth (webhook-driven); mock mode writes directly.
 *
 * Polar specifics vs the old PayPal wiring: checkout returns a hosted `url`; identity is carried
 * by a real Customer linked via `external_customer_id = userId` (no `custom_id`); the $5/mo API
 * add-on is its own subscription (a separate product); and cancellation is scheduled for the
 * period end (`cancelAtPeriodEnd`) rather than immediate - access persists until `revoked`.
 */

export type CheckoutResult = { url: string };

/** GET a Polar subscription by id (used by reconcile + the webhook). Live mode only. */
export async function getPolarSubscription(id: string): Promise<PolarSubscription> {
  return polar().subscriptions.get({ id });
}

/**
 * Start a subscription checkout for (plan, interval).
 * - live: create a Polar checkout session and return its hosted `url`. No local row is written -
 *   the subscription.active webhook (or the post-checkout reconcile) creates it.
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

  const checkout = await polar().checkouts.create({
    products: [productIdFor(plan, interval)],
    externalCustomerId: userId,
    customerEmail: email,
    successUrl: appUrl("/settings/billing?subscribed=1&checkout_id={CHECKOUT_ID}"),
    metadata: { userId, plan, interval },
  });
  if (!checkout.url) throw new Error("Polar did not return a checkout URL.");
  return { url: checkout.url };
}

/**
 * Reconcile the local subscription directly from Polar by checkout id (live mode only).
 * Called on the post-checkout return (`/settings/billing?subscribed=1&checkout_id=…`) so the
 * billing page reflects the new plan/add-on immediately, instead of waiting for the async
 * subscription.active webhook (which races the redirect and leaves the page stale otherwise).
 *
 * Idempotent and safe to run alongside the webhook - both funnel through the same upserts. The
 * external-customer guard prevents a crafted `?checkout_id` from syncing someone else's
 * checkout onto the current account. No-op in mock mode or before the checkout completes.
 */
export async function reconcileSubscription(checkoutId: string, userId: string): Promise<void> {
  if (!isLiveBilling()) return;
  const checkout = await polar().checkouts.get({ id: checkoutId });

  // Only reconcile a checkout that belongs to this user (external_customer_id == userId).
  if (checkout.externalCustomerId && checkout.externalCustomerId !== userId) return;
  if (!checkout.subscriptionId) return; // not completed yet

  const sub = await getPolarSubscription(checkout.subscriptionId);

  // Add-on subscription: its product is the API add-on product.
  if (isAddonProduct(sub.productId)) {
    if (sub.status === "active" || sub.status === "trialing") {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { apiAddonActive: true, providerAddonSubId: sub.id },
      });
    }
    return;
  }

  const input = fromPolarSubscription(sub, userId);
  if (input) await syncSubscription(input);
}

/**
 * Cancel the user's subscription at the end of the current period (decision: keep access until
 * the period they paid for ends). Live: schedule cancellation on Polar via
 * `cancelAtPeriodEnd`; the subscription.revoked webhook flips status to `canceled` at period
 * end. Both modes set the local `cancelAtPeriodEnd` flag (status stays active so entitlement
 * persists). Mock has no webhook, so the flag is the visible effect.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) throw new Error("No subscription found.");

  if (isLiveBilling()) {
    if (!sub.providerSubId) throw new Error("No active subscription to cancel.");
    await polar().subscriptions.update({
      id: sub.providerSubId,
      subscriptionUpdate: { cancelAtPeriodEnd: true },
    });
  }
  await prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });
}

export type AddonResult = { enabled: boolean; url?: string };

/**
 * Enable/disable the $5/mo API add-on. In live mode the add-on is its own Polar subscription:
 * enabling opens a checkout and returns its `url` (the webhook flips `apiAddonActive` true on
 * activation); disabling cancels it at period end. Mock mode flips the flag directly.
 */
export async function toggleApiAddon(userId: string, enable: boolean): Promise<AddonResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) throw new Error("No active subscription to modify.");

  if (isLiveBilling()) {
    if (enable) {
      if (!API_ADDON_PRODUCT) throw new Error("POLAR_PRODUCT_API_ADDON is not configured.");
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const checkout = await polar().checkouts.create({
        products: [API_ADDON_PRODUCT],
        externalCustomerId: userId,
        customerEmail: user?.email ?? undefined,
        successUrl: appUrl("/settings/billing?addon=1&checkout_id={CHECKOUT_ID}"),
        metadata: { userId, kind: "addon" },
      });
      if (!checkout.url) throw new Error("Polar did not return a checkout URL for the add-on.");
      // Not active yet - the webhook sets apiAddonActive=true once the add-on sub activates.
      return { enabled: false, url: checkout.url };
    }
    if (sub.providerAddonSubId) {
      await polar().subscriptions.update({
        id: sub.providerAddonSubId,
        subscriptionUpdate: { cancelAtPeriodEnd: true },
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
 * outside it we deny. No automatic Polar refund here - staff issue it from the admin queue.
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
  // create a duplicate if one is already pending for this user - still return ok.
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
    subject: `Refund request - ${email}`,
    text: `User ${userId} (${email}) requested a refund on plan ${sub.plan}/${sub.interval}.`,
  });
  return { ok: true, message: "Refund request received - our team will process it within 2 business days." };
}

// ─────────────────────────── Subscription sync (shared) ───────────────────────────

export interface SyncInput {
  userId: string;
  plan: PlanKey;
  interval: BillingInterval;
  status: Subscription["status"];
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd?: boolean;
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
    cancelAtPeriodEnd: false,
    providerCustomerId: `mock_customer_${userId.slice(0, 12)}`,
    providerSubId: `mock_sub_${userId.slice(0, 12)}`,
  });
}

// ─────────────────────────── Polar webhook normalization ───────────────────────────

/** Map a Polar subscription resource → our SyncInput (live mode webhook + reconcile). */
export function fromPolarSubscription(
  sub: PolarSubscription,
  userId: string,
): SyncInput | null {
  const mapped = sub.productId ? planFromProductId(sub.productId) : null;
  if (!mapped) return null;

  const status = mapPolarStatus(sub.status);
  // Polar exposes no separate trial-end field: while `trialing`, currentPeriodEnd is the trial end.
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  return {
    userId,
    plan: mapped.plan,
    interval: mapped.interval,
    status,
    trialEndsAt: status === "trialing" ? periodEnd : null,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
    providerCustomerId: sub.customerId ?? null,
    providerSubId: sub.id,
  };
}

/** Map a Polar subscription status → our local enum. */
export function mapPolarStatus(s: string): Subscription["status"] {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "incomplete":
      return "trialing"; // awaiting first payment - treated as in-trial until active
    case "past_due":
      return "past_due";
    case "unpaid":
      return "paused";
    default:
      return "canceled"; // canceled | incomplete_expired | anything unexpected
  }
}

/** Resolve our userId from a Polar subscription's linked customer external id. */
export function userIdFromPolarSubscription(sub: PolarSubscription): string | null {
  return sub.customer?.externalId ?? null;
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

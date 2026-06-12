import "server-only";
import type Stripe from "stripe";
import type { BillingInterval, PlanKey, Subscription } from "@prisma/client";
import { prisma } from "@/server/db";
import { mailer } from "@/server/mailer";
import {
  API_ADDON_PRICE,
  appUrl,
  getStripe,
  isLiveBilling,
  planFromPriceId,
  priceIdFor,
} from "@/server/stripe";

/**
 * Billing service (docs/implementation/10). One module both modes share: the live path talks
 * to Stripe, the mock path drives the same `Subscription` upsert logic via internal pages.
 * Stripe is the source of truth in live mode (webhook-driven); mock mode writes directly.
 */

const TRIAL_DAYS = 7;
const REFUND_WINDOW_DAYS = 7;

export type CheckoutResult = { url: string };

/**
 * Start a subscription checkout for (plan, interval).
 * - live: create/lookup Stripe Customer, open a Checkout Session with a 7-day trial.
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

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(userId, email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS },
    success_url: appUrl("/settings/billing?subscribed=1"),
    cancel_url: appUrl("/settings/plans?canceled=1"),
    client_reference_id: userId,
    metadata: { userId, plan, interval },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url };
}

/** Open the Stripe Billing Portal (manage card, cancel, invoices). Mock → internal portal. */
export async function createPortal(userId: string): Promise<CheckoutResult> {
  if (!isLiveBilling()) return { url: "/billing/mock/portal" };

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) throw new Error("No Stripe customer for this user.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: appUrl("/settings/billing"),
  });
  return { url: session.url };
}

/** Enable/disable the $5 API add-on. Live: add/remove a subscription item; mock: flip flag. */
export async function toggleApiAddon(userId: string, enable: boolean): Promise<void> {
  if (isLiveBilling()) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubId) throw new Error("No active subscription to modify.");
    if (!API_ADDON_PRICE) throw new Error("STRIPE_PRICE_API_ADDON is not configured.");
    const stripe = getStripe();
    const full = await stripe.subscriptions.retrieve(sub.stripeSubId);
    const existing = full.items.data.find((i) => i.price.id === API_ADDON_PRICE);
    if (enable && !existing) {
      await stripe.subscriptionItems.create({ subscription: sub.stripeSubId, price: API_ADDON_PRICE });
    } else if (!enable && existing) {
      await stripe.subscriptionItems.del(existing.id);
    }
    // Reflect optimistically; the webhook will confirm on the next subscription.updated.
  }
  await prisma.subscription.update({
    where: { userId },
    data: { apiAddonActive: enable },
  });
}

export type RefundResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Request a refund (D-016). Within the 7-day window we record the request + notify support;
 * outside it we deny. No automatic Stripe refund in MVP.
 */
export async function requestRefund(userId: string, email: string): Promise<RefundResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { ok: false, message: "No subscription found." };

  // Approximate "last charge" as the start of the current period (trial start or renewal).
  const anchor = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd.getTime() - intervalMs(sub.interval))
    : sub.createdAt;
  const withinWindow = Date.now() - anchor.getTime() <= REFUND_WINDOW_DAYS * 86_400_000;
  if (!withinWindow) {
    return { ok: false, message: "Refund window has passed (7-day money-back guarantee)." };
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
  stripeCustomerId?: string | null;
  stripeSubId?: string | null;
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

/** Mock-only: subscribe with a fresh 7-day trial (drives the same upsert the webhook would). */
export async function mockActivate(
  userId: string,
  plan: PlanKey,
  interval: BillingInterval,
): Promise<void> {
  const now = Date.now();
  await syncSubscription({
    userId,
    plan,
    interval,
    status: "trialing",
    trialEndsAt: new Date(now + TRIAL_DAYS * 86_400_000),
    currentPeriodEnd: new Date(now + intervalMs(interval)),
    stripeCustomerId: `mock_cus_${userId.slice(0, 12)}`,
    stripeSubId: `mock_sub_${userId.slice(0, 12)}`,
  });
}

/** Mock-only: cancel the current subscription (portal "Cancel"). */
export async function mockCancel(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: { status: "canceled" },
  });
}

// ─────────────────────────── Stripe webhook normalization ───────────────────────────

/** Map a Stripe subscription object → our SyncInput (live mode webhook). */
export function fromStripeSubscription(
  sub: Stripe.Subscription,
  userId: string,
): SyncInput | null {
  const priceId = sub.items.data[0]?.price.id;
  const mapped = priceId ? planFromPriceId(priceId) : null;
  if (!mapped) return null;
  const addon = API_ADDON_PRICE
    ? sub.items.data.some((i) => i.price.id === API_ADDON_PRICE)
    : false;
  return {
    userId,
    plan: mapped.plan,
    interval: mapped.interval,
    status: mapStripeStatus(sub.status),
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000)
      : null,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubId: sub.id,
    apiAddonActive: addon,
  };
}

function mapStripeStatus(s: Stripe.Subscription.Status): Subscription["status"] {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    default:
      return "canceled"; // canceled | incomplete | incomplete_expired
  }
}

// ─────────────────────────── helpers ───────────────────────────

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await getStripe().customers.create({ email, metadata: { userId } });
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

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

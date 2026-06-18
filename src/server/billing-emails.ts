import "server-only";
import { prisma } from "@/server/db";
import { getPlan } from "@/server/plans";
import { appUrl } from "@/server/billing-config";
import {
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
} from "@/server/email";

/**
 * Transactional billing emails (doc 10). Called from the PayPal webhook + mock checkout. Every
 * function is BEST-EFFORT: it loads the user + plan, sends, and swallows errors so a mail failure
 * never breaks webhook handling or a checkout redirect. Each logs on failure for diagnosis.
 */

const MANAGE_URL = appUrl("/settings/billing");
const PLANS_URL = appUrl("/settings/plans");

async function loadContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, subscription: true },
  });
  if (!user?.subscription) return null;
  const plan = await getPlan(user.subscription.plan);
  return {
    email: user.email,
    displayName: user.displayName,
    sub: user.subscription,
    planName: plan?.name ?? user.subscription.plan,
    amount: plan ? (user.subscription.interval === "year" ? plan.yearly : plan.monthly) : 0,
  };
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(d);
  } catch {
    return null;
  }
}

/** Subscription went active or a trial started - confirm it. */
export async function notifySubscriptionActive(userId: string): Promise<void> {
  try {
    const ctx = await loadContext(userId);
    if (!ctx) return;
    const trialing = ctx.sub.status === "trialing";
    await sendPaymentConfirmationEmail(ctx.email, {
      planName: ctx.planName,
      interval: ctx.sub.interval,
      amount: ctx.amount,
      trialing,
      nextBillingDate: formatDate(trialing ? ctx.sub.trialEndsAt : ctx.sub.currentPeriodEnd),
      manageUrl: MANAGE_URL,
      displayName: ctx.displayName,
    });
  } catch (err) {
    console.error("notifySubscriptionActive failed:", err);
  }
}

/** A recurring charge failed - prompt to update the payment method. */
export async function notifyPaymentFailed(userId: string): Promise<void> {
  try {
    const ctx = await loadContext(userId);
    if (!ctx) return;
    await sendPaymentFailedEmail(ctx.email, {
      planName: ctx.planName,
      manageUrl: MANAGE_URL,
      displayName: ctx.displayName,
    });
  } catch (err) {
    console.error("notifyPaymentFailed failed:", err);
  }
}

/** Subscription canceled or expired - confirm and offer to resubscribe. */
export async function notifySubscriptionCanceled(userId: string): Promise<void> {
  try {
    const ctx = await loadContext(userId);
    if (!ctx) return;
    await sendSubscriptionCanceledEmail(ctx.email, {
      planName: ctx.planName,
      resubscribeUrl: PLANS_URL,
      displayName: ctx.displayName,
    });
  } catch (err) {
    console.error("notifySubscriptionCanceled failed:", err);
  }
}

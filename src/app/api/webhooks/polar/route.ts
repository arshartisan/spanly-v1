import { NextResponse } from "next/server";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { prisma } from "@/server/db";
import { isLiveBilling } from "@/server/billing-config";
import {
  isAddonProduct,
  verifyWebhook,
  WebhookVerificationError,
  type PolarWebhookEvent,
} from "@/server/polar";
import {
  fromPolarSubscription,
  getPolarSubscription,
  syncSubscription,
  userIdFromPolarSubscription,
} from "@/server/billing";
import {
  notifyPaymentFailed,
  notifySubscriptionActive,
  notifySubscriptionCanceled,
} from "@/server/billing-emails";

// POST /api/webhooks/polar - Polar event sink (doc 10). No auth: identity is the Standard-Webhooks
// signature, verified locally with POLAR_WEBHOOK_SECRET. Polar is the source of truth in live
// mode; subscriptions upsert idempotently keyed by our userId (the customer's external_id).
// Raw body is required for verification, so we read req.text() and let validateEvent parse it.

export async function POST(req: Request) {
  if (!isLiveBilling()) {
    // Mock mode drives subscription state via /api/billing/mock/*; no webhook is used.
    return NextResponse.json({ ignored: "mock mode" }, { status: 200 });
  }

  const raw = await req.text();
  let event: PolarWebhookEvent;
  try {
    event = verifyWebhook(raw, req.headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
    }
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  // Best-effort event log (doc 19). Never let logging break webhook handling.
  const logId = await logWebhookEvent(event.type, "received", "data" in event ? idOf(event.data) : null);

  try {
    await handleEvent(event);
  } catch (err) {
    // Return 500 so Polar retries; log for diagnosis (never log tokens/secrets).
    console.error(`Polar webhook handler error for ${event.type}:`, err);
    await markWebhookEvent(logId, "failed", err instanceof Error ? err.message : "Handler failed.");
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
  await markWebhookEvent(logId, "processed");
  return NextResponse.json({ received: true });
}

/** Best-effort id extraction from a webhook payload's `data` for the event log. */
function idOf(data: unknown): string | null {
  if (data && typeof data === "object" && "id" in data) {
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** Append a WebhookEvent row; returns its id (or null on failure). Best-effort - never throws. */
async function logWebhookEvent(
  type: string,
  status: string,
  refId: string | null,
): Promise<string | null> {
  try {
    const row = await prisma.webhookEvent.create({
      data: { source: "polar", type, status, refId: refId ?? undefined },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** Update a previously-logged WebhookEvent's status/error. Best-effort - never throws. */
async function markWebhookEvent(
  id: string | null,
  status: string,
  error?: string,
): Promise<void> {
  if (!id) return;
  try {
    await prisma.webhookEvent.update({ where: { id }, data: { status, error: error ?? null } });
  } catch {
    // Logging failures must never break webhook handling.
  }
}

async function handleEvent(event: PolarWebhookEvent): Promise<void> {
  switch (event.type) {
    // New paid/recovered subscription, or any change to one.
    case "subscription.active":
    case "subscription.updated":
    case "subscription.uncanceled": {
      await applySubscription(event.data, event.type === "subscription.active");
      return;
    }

    case "subscription.past_due": {
      const sub = event.data;
      if (isAddonProduct(sub.productId)) return; // add-on dunning is handled by Polar
      const userId = userIdFromPolarSubscription(sub);
      await prisma.subscription.updateMany({
        where: { providerSubId: sub.id },
        data: { status: "past_due" },
      });
      if (userId) await notifyPaymentFailed(userId);
      return;
    }

    // Cancellation scheduled for period end: keep access (status) until it's revoked.
    case "subscription.canceled": {
      const sub = event.data;
      if (isAddonProduct(sub.productId)) return;
      await prisma.subscription.updateMany({
        where: { providerSubId: sub.id },
        data: { cancelAtPeriodEnd: true },
      });
      return;
    }

    // Subscription definitively ended.
    case "subscription.revoked": {
      const sub = event.data;
      const userId = userIdFromPolarSubscription(sub);
      if (isAddonProduct(sub.productId)) {
        if (userId) {
          await prisma.subscription.updateMany({
            where: { userId },
            data: { apiAddonActive: false, providerAddonSubId: null },
          });
        }
        return;
      }
      await prisma.subscription.updateMany({
        where: { providerSubId: sub.id },
        data: { status: "canceled" },
      });
      if (userId) await notifySubscriptionCanceled(userId);
      return;
    }

    // A recurring charge succeeded - refresh the local period from the parent subscription.
    case "order.paid": {
      const subId = event.data.subscriptionId;
      if (!subId) return;
      const row = await prisma.subscription.findFirst({
        where: { providerSubId: subId },
        select: { userId: true },
      });
      if (!row) return;
      const full = await getPolarSubscription(subId);
      const input = fromPolarSubscription(full, row.userId);
      if (input) await syncSubscription(input);
      return;
    }

    // A refund was processed on an order - mark a matching pending request refunded (best-effort).
    case "order.refunded": {
      const subId = event.data.subscriptionId;
      if (!subId) return;
      const row = await prisma.subscription.findFirst({
        where: { providerSubId: subId },
        select: { userId: true },
      });
      if (!row) return;
      await prisma.refundRequest.updateMany({
        where: { userId: row.userId, status: "pending" },
        data: { status: "refunded", decidedAt: new Date() },
      });
      return;
    }

    default:
      return; // ignore unrelated events
  }
}

/**
 * Upsert the local subscription from a Polar subscription resource. Handles both the plan
 * subscription (full sync) and the standalone API add-on subscription (flag flip). `notify`
 * sends the activation email (only on subscription.active, to avoid noise on updates).
 */
async function applySubscription(sub: PolarSubscription, notify: boolean): Promise<void> {
  const userId = userIdFromPolarSubscription(sub);
  if (!userId) return;

  if (isAddonProduct(sub.productId)) {
    const active = sub.status === "active" || sub.status === "trialing";
    await prisma.subscription.updateMany({
      where: { userId },
      data: active
        ? { apiAddonActive: true, providerAddonSubId: sub.id }
        : { apiAddonActive: false },
    });
    return;
  }

  const input = fromPolarSubscription(sub, userId);
  if (!input) return;
  await syncSubscription(input);
  if (notify) await notifySubscriptionActive(userId);
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { isLiveBilling } from "@/server/billing-config";
import { verifyWebhookSignature } from "@/server/paypal";
import {
  fromPaypalSubscription,
  getPaypalSubscription,
  syncSubscription,
  type PaypalSubscription,
} from "@/server/billing";
import {
  notifyPaymentFailed,
  notifySubscriptionActive,
  notifySubscriptionCanceled,
} from "@/server/billing-emails";

// POST /api/webhooks/paypal - PayPal event sink (doc 10). No auth: identity is the signature,
// verified via PayPal's verify-webhook-signature API. PayPal is the source of truth in live
// mode; subscriptions upsert idempotently keyed by our userId (carried in `custom_id`).
// Raw body is required for verification, so we read req.text() and parse it ourselves.

interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    custom_id?: string;
    billing_agreement_id?: string; // on PAYMENT.SALE.* the parent subscription id
  };
}

export async function POST(req: Request) {
  if (!isLiveBilling()) {
    // Mock mode drives subscription state via /api/billing/mock/*; no webhook is used.
    return NextResponse.json({ ignored: "mock mode" }, { status: 200 });
  }

  const raw = await req.text();
  let event: PaypalWebhookEvent;
  try {
    event = JSON.parse(raw) as PaypalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const verified = await verifyWebhookSignature(req.headers, event);
  if (!verified) {
    return NextResponse.json({ error: "Webhook verification failed." }, { status: 400 });
  }

  // Best-effort event log (doc 19). Never let logging break webhook handling.
  const logId = await logWebhookEvent(event.event_type, "received", event.id);

  try {
    await handleEvent(event);
  } catch (err) {
    // Return 500 so PayPal retries; log for diagnosis (never log tokens/secrets).
    console.error(`PayPal webhook handler error for ${event.event_type}:`, err);
    await markWebhookEvent(logId, "failed", err instanceof Error ? err.message : "Handler failed.");
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
  await markWebhookEvent(logId, "processed");
  return NextResponse.json({ received: true });
}

/** Append a WebhookEvent row; returns its id (or null on failure). Best-effort - never throws. */
async function logWebhookEvent(
  type: string,
  status: string,
  refId: string,
): Promise<string | null> {
  try {
    const row = await prisma.webhookEvent.create({
      data: { source: "paypal", type, status, refId },
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

/** Parse our `custom_id`: "userId" for the plan sub, "userId:addon" for the add-on sub. */
function parseCustomId(customId?: string): { userId: string; isAddon: boolean } | null {
  if (!customId) return null;
  if (customId.endsWith(":addon")) {
    return { userId: customId.slice(0, -":addon".length), isAddon: true };
  }
  return { userId: customId, isAddon: false };
}

async function handleEvent(event: PaypalWebhookEvent): Promise<void> {
  const resource = event.resource ?? {};

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED": {
      const parsed = parseCustomId(resource.custom_id);
      if (!parsed || !resource.id) return;
      if (parsed.isAddon) {
        await prisma.subscription.updateMany({
          where: { userId: parsed.userId },
          data: { apiAddonActive: true, providerAddonSubId: resource.id },
        });
        return;
      }
      // Re-fetch the full subscription for billing cycle + next-bill details.
      const full = await getPaypalSubscription(resource.id);
      const input = fromPaypalSubscription(full, parsed.userId);
      if (input) await syncSubscription(input);
      // Confirm only on first activation; UPDATED fires on many benign changes (would be noisy).
      if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
        await notifySubscriptionActive(parsed.userId);
      }
      return;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const parsed = parseCustomId(resource.custom_id);
      if (!parsed) return;
      if (parsed.isAddon) {
        await prisma.subscription.updateMany({
          where: { userId: parsed.userId },
          data: { apiAddonActive: false },
        });
      } else if (resource.id) {
        await prisma.subscription.updateMany({
          where: { providerSubId: resource.id },
          data: { status: "paused" },
        });
      }
      return;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const parsed = parseCustomId(resource.custom_id);
      if (parsed?.isAddon) {
        await prisma.subscription.updateMany({
          where: { userId: parsed.userId },
          data: { apiAddonActive: false, providerAddonSubId: null },
        });
      } else if (resource.id) {
        await prisma.subscription.updateMany({
          where: { providerSubId: resource.id },
          data: { status: "canceled" },
        });
        if (parsed?.userId) await notifySubscriptionCanceled(parsed.userId);
      }
      return;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const parsed = parseCustomId(resource.custom_id);
      if (parsed?.isAddon || !resource.id) return;
      await prisma.subscription.updateMany({
        where: { providerSubId: resource.id },
        data: { status: "past_due" },
      });
      if (parsed?.userId) await notifyPaymentFailed(parsed.userId);
      return;
    }

    case "PAYMENT.SALE.COMPLETED": {
      // A recurring charge succeeded - refresh the local period end from the parent sub.
      const subId = resource.billing_agreement_id;
      if (!subId) return;
      const row = await prisma.subscription.findFirst({
        where: { providerSubId: subId },
        select: { userId: true },
      });
      if (!row) return;
      const full: PaypalSubscription = await getPaypalSubscription(subId);
      const input = fromPaypalSubscription(full, row.userId);
      if (input) await syncSubscription(input);
      return;
    }

    default:
      return; // ignore unrelated events
  }
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/server/db";
import { getStripe, isLiveBilling } from "@/server/stripe";
import { fromStripeSubscription, syncSubscription } from "@/server/billing";

// POST /api/webhooks/stripe — Stripe event sink (doc 10). No auth: identity is the signature.
// Stripe is the source of truth in live mode; subscriptions upsert idempotently by stripeSubId.
// Raw body is required for signature verification, so we read req.text() (no JSON parsing).
export async function POST(req: Request) {
  if (!isLiveBilling()) {
    // Mock mode drives subscription state via /api/billing/mock/*; no webhook is used.
    // No WebhookEvent row is written here — there is no real inbound Stripe event to log.
    return NextResponse.json({ ignored: "mock mode" }, { status: 200 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Missing webhook secret/signature." }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: `Webhook verification failed: ${message}` }, { status: 400 });
  }

  // Best-effort event log (doc 19). Never let logging break webhook handling.
  const logId = await logWebhookEvent(event.type, "received", event.id);

  try {
    await handleEvent(event);
  } catch (err) {
    // Return 500 so Stripe retries; log for diagnosis (never log tokens/secrets).
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    await markWebhookEvent(logId, "failed", err instanceof Error ? err.message : "Handler failed.");
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
  await markWebhookEvent(logId, "processed");
  return NextResponse.json({ received: true });
}

/** Append a WebhookEvent row; returns its id (or null on failure). Best-effort — never throws. */
async function logWebhookEvent(
  type: string,
  status: string,
  refId: string,
): Promise<string | null> {
  try {
    const row = await prisma.webhookEvent.create({
      data: { source: "stripe", type, status, refId },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** Update a previously-logged WebhookEvent's status/error. Best-effort — never throws. */
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

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
      if (!userId || !session.subscription) return;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      const input = fromStripeSubscription(sub, userId);
      if (input) await syncSubscription(input);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(sub.metadata?.userId, sub.customer);
      if (!userId) return;
      const input = fromStripeSubscription(sub, userId);
      if (input) await syncSubscription(input);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubId: sub.id },
        data: { status: "canceled" },
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: "past_due" },
        });
      }
      return;
    }
    default:
      return; // ignore unrelated events
  }
}

/** Resolve our userId from subscription metadata or, failing that, the Stripe customer id. */
async function resolveUserId(
  metaUserId: string | undefined,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  if (metaUserId) return metaUserId;
  const customerId = typeof customer === "string" ? customer : customer.id;
  const row = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  return row?.userId ?? null;
}

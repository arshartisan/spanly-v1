import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";

/**
 * Webhook service (design doc 12). Per-user post-completion callbacks signed with HMAC-SHA256.
 * No `server-only` import: `deliverPostWebhook` is called from the publish runner inside the
 * standalone worker process. Delivery is best-effort, time-boxed, and idempotent per post.
 */

const DELIVERY_TIMEOUT_MS = 8000;

export interface WebhookView {
  url: string;
  secret: string; // shown to the user so they can verify signatures
  createdAt: string;
}

/** The user's webhook config, or null if none set. */
export async function getWebhook(userId: string): Promise<WebhookView | null> {
  const w = await prisma.webhookEndpoint.findUnique({ where: { userId } });
  if (!w) return null;
  return { url: w.url, secret: w.secret, createdAt: w.createdAt.toISOString() };
}

/** Set/replace the webhook URL. Secret is generated once and kept stable across URL edits. */
export async function upsertWebhook(userId: string, url: string): Promise<WebhookView> {
  const w = await prisma.webhookEndpoint.upsert({
    where: { userId },
    create: { userId, url, secret: `whsec_${randomBytes(24).toString("hex")}` },
    update: { url },
  });
  return { url: w.url, secret: w.secret, createdAt: w.createdAt.toISOString() };
}

/** Remove the webhook. */
export async function deleteWebhook(userId: string): Promise<void> {
  await prisma.webhookEndpoint.deleteMany({ where: { userId } });
}

/** Hex HMAC-SHA256 of `body` under `secret` (the value sent in `X-Spanly-Signature`). */
export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Constant-time signature check (for receivers / tests). */
export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = signPayload(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PostWebhookPayload {
  event: "post.completed";
  postId: string;
  status: string;
  publishedAt: string | null;
  targets: {
    platform: string;
    handle: string;
    status: string;
    externalUrl: string | null;
    error: string | null;
  }[];
}

/**
 * Deliver the post-completion webhook for a terminal post, exactly once. Loads the owner's
 * webhook config; if present and not already sent, POSTs a signed payload and stamps
 * `webhookSentAt`. Safe to call on every rollup — the idempotency guard makes repeats no-ops.
 */
export async function deliverPostWebhook(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: { include: { webhook: true } },
      targets: { include: { account: true } },
    },
  });
  if (!post) return;
  if (post.status !== "posted" && post.status !== "failed") return; // only terminal states
  if (post.webhookSentAt) return; // already delivered
  const webhook = post.user.webhook;
  if (!webhook) return;

  // Claim delivery first (idempotent): set the stamp before sending so concurrent rollups skip.
  const claim = await prisma.post.updateMany({
    where: { id: postId, webhookSentAt: null },
    data: { webhookSentAt: new Date() },
  });
  if (claim.count === 0) return; // lost the race; another rollup is delivering

  const payload: PostWebhookPayload = {
    event: "post.completed",
    postId: post.id,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    targets: post.targets.map((t) => ({
      platform: t.account.platform,
      handle: t.account.handle,
      status: t.status,
      externalUrl: t.externalUrl,
      error: t.error,
    })),
  };
  const body = JSON.stringify(payload);
  const signature = signPayload(webhook.secret, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Spanly-Signature": signature,
        "X-Spanly-Event": payload.event,
      },
      body,
      signal: controller.signal,
    });
    // We don't retry on non-2xx in MVP; the stamp prevents duplicate sends regardless.
  } catch {
    // Network/timeout: swallow so publishing is never blocked by a bad webhook URL.
  } finally {
    clearTimeout(timer);
  }
}

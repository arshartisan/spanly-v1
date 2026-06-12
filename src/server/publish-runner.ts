/**
 * Publish runner (docs/implementation/08 + 09). The actual provider.publish + per-target
 * status updates + parent-post rollup. Imported by the worker (and later the retry route).
 * No `server-only` import: this runs in the standalone worker process.
 */
import { prisma } from "@/server/db";
import { getProvider } from "@/providers/registry";
import { decryptTokens, encryptTokens } from "@/server/crypto";
import { deliverPostWebhook } from "@/server/webhooks";
import type { PlatformKey } from "@/lib/platforms";
import type { PublishInput } from "@/providers/types";

export const MAX_ATTEMPTS = 5;

/** Recompute the parent Post.status from its targets (doc 08 rollup). */
export async function recomputePostStatus(postId: string): Promise<void> {
  const targets = await prisma.postTarget.findMany({ where: { postId } });
  if (targets.length === 0) return;

  const allSuccess = targets.every((t) => t.status === "success");
  const anyActive = targets.some((t) => t.status === "pending" || t.status === "publishing");

  if (allSuccess) {
    const publishedAt = new Date(
      Math.max(...targets.map((t) => t.publishedAt?.getTime() ?? Date.now())),
    );
    await prisma.post.update({ where: { id: postId }, data: { status: "posted", publishedAt } });
  } else if (anyActive) {
    await prisma.post.update({ where: { id: postId }, data: { status: "publishing" } });
    return; // not terminal yet — no webhook
  } else {
    // All terminal, at least one failed → post surfaces as failed (per-target UI shows detail).
    await prisma.post.update({ where: { id: postId }, data: { status: "failed" } });
  }

  // Terminal (posted/failed): deliver the post-completion webhook once (doc 12). Best-effort;
  // never let a webhook failure affect publishing. The delivery guard makes this idempotent.
  await deliverPostWebhook(postId);
}

/**
 * Publish a single PostTarget exactly once. Throws on a retryable failure so BullMQ retries
 * with backoff; marks `failed` once attempts are exhausted or the error is permanent.
 */
export async function publishTarget(targetId: string): Promise<void> {
  const target = await prisma.postTarget.findUnique({
    where: { id: targetId },
    include: {
      account: true,
      post: { include: { media: { include: { media: true }, orderBy: { order: "asc" } } } },
    },
  });
  if (!target) return;
  if (target.status === "success") return; // idempotent: already done

  // Mark publishing + count this attempt; flip the parent post to publishing too.
  const updated = await prisma.postTarget.update({
    where: { id: targetId },
    data: { status: "publishing", attempts: { increment: 1 } },
  });
  await prisma.post.update({
    where: { id: target.postId },
    data: { status: "publishing" },
  });

  const account = target.account;
  const platform = account.platform as PlatformKey;
  const provider = getProvider(platform);
  let tokens = decryptTokens(account.encryptedTokens);

  // Refresh an expired token before publishing (doc 08). Auth failure here is permanent.
  if (tokens.expiresAt && new Date(tokens.expiresAt).getTime() < Date.now()) {
    try {
      tokens = await provider.refresh(tokens);
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          encryptedTokens: encryptTokens(tokens),
          tokenExpiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
          status: "active",
        },
      });
    } catch {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { status: "expired" },
      });
      await prisma.postTarget.update({
        where: { id: targetId },
        data: { status: "failed", error: "Account authorization expired — reconnect to retry." },
      });
      await recomputePostStatus(target.postId);
      return;
    }
  }

  const input: PublishInput = {
    type: target.post.type as PublishInput["type"],
    caption: target.caption,
    media: target.post.media.map((pm) => ({
      kind: pm.media.kind as PublishInput["media"][number]["kind"],
      url: pm.media.url,
      order: pm.order,
    })),
    idempotencyKey: target.idempotencyKey,
  };

  const result = await provider.publish(input, tokens);

  if (result.ok) {
    await prisma.postTarget.update({
      where: { id: targetId },
      data: {
        status: "success",
        externalPostId: result.externalPostId,
        externalUrl: result.url ?? null,
        publishedAt: new Date(),
        error: null,
      },
    });
    await recomputePostStatus(target.postId);
    return;
  }

  // Failure: retry while transient + attempts remain, else fail permanently.
  if (result.retryable && updated.attempts < MAX_ATTEMPTS) {
    await prisma.postTarget.update({
      where: { id: targetId },
      data: { status: "pending", error: result.error },
    });
    await recomputePostStatus(target.postId);
    throw new Error(`Retryable publish failure for ${platform}: ${result.error}`);
  }

  await prisma.postTarget.update({
    where: { id: targetId },
    data: { status: "failed", error: result.error },
  });
  await recomputePostStatus(target.postId);
}

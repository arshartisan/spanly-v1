import "server-only";
import { prisma } from "@/server/db";
import { enqueuePublish } from "@/server/queue";
import { nextQueueSlot, type QueueSettingsDef } from "@/server/queue-slots";
import {
  resolveCaption,
  validatePostTargets,
  type AccountValidationError,
  type CreatePostInput,
  type PostTypeKey,
  type UpdatePostInput,
} from "@/lib/schemas/post";
import type { Capability, PlatformKey } from "@/lib/platforms";
import type { Post, Prisma } from "@prisma/client";

/**
 * Post/composer service (docs/implementation/06 + 08). Owns the Post + PostTarget +
 * PostMedia write model. On publish/schedule/queue we fan a Post out to one PostTarget per
 * selected account, each carrying its resolved caption and a unique idempotencyKey
 * (`<postId>:<accountId>`). Actual job dispatch + publishing land in Phase 5/6 — here we only
 * establish the durable records and the correct status/publishAt.
 */

export type EligibleAccount = {
  id: string;
  platform: PlatformKey;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  capabilities: Capability[];
};

/** Active (not soft-deleted) accounts whose capabilities include the post type. */
export async function eligibleAccounts(
  userId: string,
  type: PostTypeKey,
): Promise<EligibleAccount[]> {
  const accounts = await prisma.socialAccount.findMany({
    where: { userId, disconnectedAt: null, status: "active", capabilities: { has: type } },
    orderBy: { connectedAt: "asc" },
  });
  return accounts.map((a) => ({
    id: a.id,
    platform: a.platform as PlatformKey,
    handle: a.handle,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    capabilities: a.capabilities as Capability[],
  }));
}

function asPerPlatform(value: Prisma.JsonValue): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  return {};
}

/** Replace a post's ordered media links with the given set. */
async function syncMedia(
  tx: Prisma.TransactionClient,
  postId: string,
  media: { mediaId: string; order: number }[],
): Promise<void> {
  await tx.postMedia.deleteMany({ where: { postId } });
  if (media.length === 0) return;
  await tx.postMedia.createMany({
    data: media.map((m) => ({ postId, mediaId: m.mediaId, order: m.order })),
  });
}

/** Create a draft Post (+ media links). Targets are only created at publish/schedule time. */
export async function createDraft(userId: string, input: CreatePostInput): Promise<Post> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        userId,
        type: input.type,
        mainCaption: input.mainCaption,
        perPlatform: input.perPlatform,
        status: "draft",
        scheduleMode: "now",
      },
    });
    await syncMedia(tx, post.id, input.media);
    return post;
  });
}

/** Load a post owned by the user, or null. */
export async function getOwnedPost(userId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId },
    include: {
      media: { include: { media: true }, orderBy: { order: "asc" } },
      targets: true,
    },
  });
  return post;
}

/** Update an editable post's fields + media. Posted/publishing posts are not editable. */
export async function updatePost(
  userId: string,
  postId: string,
  input: UpdatePostInput,
): Promise<Post | null> {
  const existing = await prisma.post.findFirst({ where: { id: postId, userId } });
  if (!existing) return null;
  if (existing.status === "posted" || existing.status === "publishing") return null;

  return prisma.$transaction(async (tx) => {
    const post = await tx.post.update({
      where: { id: postId },
      data: {
        type: input.type ?? existing.type,
        mainCaption: input.mainCaption ?? existing.mainCaption,
        perPlatform: input.perPlatform ?? (existing.perPlatform as Prisma.InputJsonValue),
      },
    });
    if (input.media) await syncMedia(tx, postId, input.media);
    return post;
  });
}

/** Delete a post (and its targets/media via cascade). */
export async function deletePost(userId: string, postId: string): Promise<boolean> {
  const res = await prisma.post.deleteMany({ where: { id: postId, userId } });
  return res.count > 0;
}

/** Duplicate a post into a fresh draft (edit screen action). */
export async function duplicatePost(userId: string, postId: string): Promise<Post | null> {
  const src = await getOwnedPost(userId, postId);
  if (!src) return null;
  return prisma.$transaction(async (tx) => {
    const copy = await tx.post.create({
      data: {
        userId,
        type: src.type,
        mainCaption: src.mainCaption,
        perPlatform: src.perPlatform as Prisma.InputJsonValue,
        status: "draft",
        scheduleMode: "now",
      },
    });
    if (src.media.length > 0) {
      await tx.postMedia.createMany({
        data: src.media.map((m) => ({ postId: copy.id, mediaId: m.mediaId, order: m.order })),
      });
    }
    return copy;
  });
}

export type DispatchOutcome =
  | { ok: true; post: Post }
  | { ok: false; status: number; errors: AccountValidationError[] | string };

/**
 * Enqueue one delayed publish job per pending target (doc 08). delay = publishAt − now
 * (0 for "post now"). jobId = idempotencyKey so duplicate enqueues collapse.
 */
async function enqueueDispatch(postId: string, publishAt: Date): Promise<void> {
  const targets = await prisma.postTarget.findMany({
    where: { postId, status: "pending" },
    select: { id: true },
  });
  const delayMs = publishAt.getTime() - Date.now();
  await enqueuePublish(targets.map((t) => ({ targetId: t.id, delayMs })));
}

/**
 * Server-side re-validation before any state transition: the post must target ≥1 eligible
 * account, have content, and every target must pass per-platform limits.
 */
async function validateForDispatch(
  userId: string,
  postId: string,
  accountIds: string[],
): Promise<
  | { ok: false; status: number; errors: AccountValidationError[] | string }
  | { ok: true; post: NonNullable<Awaited<ReturnType<typeof getOwnedPost>>>; accounts: EligibleAccount[] }
> {
  const post = await getOwnedPost(userId, postId);
  if (!post) return { ok: false, status: 404, errors: "Post not found" };
  if (post.status === "posted" || post.status === "publishing") {
    return { ok: false, status: 409, errors: "Post already published" };
  }
  if (accountIds.length === 0) {
    return { ok: false, status: 422, errors: "Select at least one account" };
  }

  const all = await eligibleAccounts(userId, post.type as PostTypeKey);
  const accounts = all.filter((a) => accountIds.includes(a.id));
  if (accounts.length !== accountIds.length) {
    return { ok: false, status: 422, errors: "One or more accounts are not eligible" };
  }

  const errors = validatePostTargets({
    type: post.type as PostTypeKey,
    mainCaption: post.mainCaption,
    perPlatform: asPerPlatform(post.perPlatform),
    mediaCount: post.media.length,
    accounts,
  });
  if (errors.length > 0) return { ok: false, status: 422, errors };

  return { ok: true, post, accounts };
}

/** (Re)create one PostTarget per selected account with the resolved caption + idempotency key. */
async function rebuildTargets(
  tx: Prisma.TransactionClient,
  post: { id: string; mainCaption: string; perPlatform: Prisma.JsonValue },
  accountIds: string[],
): Promise<void> {
  await tx.postTarget.deleteMany({ where: { postId: post.id } });
  const perPlatform = asPerPlatform(post.perPlatform);
  await tx.postTarget.createMany({
    data: accountIds.map((accountId) => ({
      postId: post.id,
      socialAccountId: accountId,
      caption: resolveCaption(post.mainCaption, perPlatform, accountId),
      idempotencyKey: `${post.id}:${accountId}`,
      status: "pending" as const,
    })),
  });
}

/** Post now: mark publishing + create targets. Worker dispatch is Phase 5. */
export async function publishNow(
  userId: string,
  postId: string,
  accountIds: string[],
): Promise<DispatchOutcome> {
  const v = await validateForDispatch(userId, postId, accountIds);
  if (!v.ok) return v;
  const post = await prisma.$transaction(async (tx) => {
    await rebuildTargets(tx, v.post, accountIds);
    return tx.post.update({
      where: { id: postId },
      data: { status: "publishing", scheduleMode: "now", publishAt: new Date() },
    });
  });
  await enqueueDispatch(post.id, post.publishAt ?? new Date());
  return { ok: true, post };
}

/** Schedule for a specific instant (UTC). */
export async function schedulePost(
  userId: string,
  postId: string,
  accountIds: string[],
  publishAt: Date,
  timezone: string,
): Promise<DispatchOutcome> {
  const v = await validateForDispatch(userId, postId, accountIds);
  if (!v.ok) return v;
  if (publishAt.getTime() <= Date.now()) {
    return { ok: false, status: 422, errors: "Scheduled time must be in the future" };
  }
  const post = await prisma.$transaction(async (tx) => {
    await rebuildTargets(tx, v.post, accountIds);
    return tx.post.update({
      where: { id: postId },
      data: { status: "scheduled", scheduleMode: "time", publishAt, timezone },
    });
  });
  await enqueueDispatch(post.id, publishAt);
  return { ok: true, post };
}

/** Add to queue: drop into the next open slot computed from the user's QueueSettings. */
export async function addToQueue(
  userId: string,
  postId: string,
  accountIds: string[],
): Promise<DispatchOutcome> {
  const v = await validateForDispatch(userId, postId, accountIds);
  if (!v.ok) return v;

  const settings = await prisma.queueSettings.findUnique({
    where: { userId },
    include: { slots: true },
  });
  if (!settings || settings.slots.length === 0) {
    return { ok: false, status: 422, errors: "No queue slots configured. Add slots in Settings → Queue." };
  }

  // Slots already filled by other queued posts can't be reused.
  const queued = await prisma.post.findMany({
    where: { userId, status: "scheduled", scheduleMode: "queue", publishAt: { not: null } },
    select: { publishAt: true },
  });
  const taken = new Set(queued.map((p) => p.publishAt!.getTime()));

  const def: QueueSettingsDef = {
    timezone: settings.timezone,
    slots: settings.slots.map((s) => ({ time: s.time, days: s.days })),
  };
  const slot = nextQueueSlot(new Date(), def, taken);
  if (!slot) return { ok: false, status: 422, errors: "No open queue slot found" };

  const post = await prisma.$transaction(async (tx) => {
    await rebuildTargets(tx, v.post, accountIds);
    return tx.post.update({
      where: { id: postId },
      data: { status: "scheduled", scheduleMode: "queue", publishAt: slot, timezone: settings.timezone },
    });
  });
  await enqueueDispatch(post.id, slot);
  return { ok: true, post };
}

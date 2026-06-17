import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AdminActionError } from "@/server/admin/errors";
import { removePublishJobs } from "@/server/queue";
import type { PostListQuery, ConnectionListQuery } from "@/lib/schemas/admin-content";

// Content & connections oversight service (doc 18). Pure `buildPostWhere` / `buildAccountWhere`
// for unit tests; the rest run Prisma queries. Reads NEVER select `encryptedTokens` - Spanlyfy
// relays content, so "moderation" = stopping scheduled sends and disconnecting accounts.

export { AdminActionError } from "@/server/admin/errors";

const EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h, token "expiring" threshold

// ─────────────────────────── Post filtering ───────────────────────────

/**
 * Pure mapping from a parsed post filter to a Prisma `PostWhereInput`. No DB calls -
 * unit-testable in isolation. `platform` joins through `targets → account.platform`;
 * `query` matches the main caption (case-insensitive contains); `from`/`to` bound `createdAt`.
 */
export function buildPostWhere(filter: PostListQuery): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};
  const and: Prisma.PostWhereInput[] = [];

  if (filter.status) and.push({ status: filter.status });
  if (filter.userId) and.push({ userId: filter.userId });

  if (filter.platform) {
    and.push({ targets: { some: { account: { platform: filter.platform } } } });
  }

  if (filter.query) {
    and.push({ mainCaption: { contains: filter.query, mode: "insensitive" } });
  }

  if (filter.from || filter.to) {
    and.push({
      createdAt: {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

// ─────────────────────────── Post reads ───────────────────────────

const postListSelect = {
  id: true,
  type: true,
  status: true,
  mainCaption: true,
  publishAt: true,
  publishedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, displayName: true } },
  targets: { select: { status: true, account: { select: { platform: true } } } },
} satisfies Prisma.PostSelect;

export type AdminPostListItem = Prisma.PostGetPayload<{ select: typeof postListSelect }>;

export interface PostListResult {
  posts: AdminPostListItem[];
  nextCursor: string | null;
}

/** Cursor-paginated cross-user post list (take+1 lookahead, newest `createdAt` first). */
export async function listPosts(filter: PostListQuery): Promise<PostListResult> {
  const where = buildPostWhere(filter);
  const take = filter.take;

  const rows = await prisma.post.findMany({
    where,
    select: postListSelect,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next ? next.id : null;
  }

  return { posts: rows, nextCursor };
}

const postDetailSelect = {
  id: true,
  type: true,
  status: true,
  mainCaption: true,
  scheduleMode: true,
  publishAt: true,
  publishedAt: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
  moderatedAt: true,
  moderationReason: true,
  user: { select: { id: true, email: true, displayName: true } },
  moderatedBy: { select: { id: true, email: true, displayName: true } },
  media: {
    select: {
      order: true,
      media: { select: { id: true, url: true, thumbnailUrl: true, kind: true } },
    },
    orderBy: { order: "asc" },
  },
  targets: {
    select: {
      id: true,
      status: true,
      externalUrl: true,
      error: true,
      account: { select: { id: true, platform: true, handle: true, displayName: true } },
    },
  },
} satisfies Prisma.PostSelect;

export type AdminPostDetail = Prisma.PostGetPayload<{ select: typeof postDetailSelect }>;

/** Full post for the admin detail page; null if not found. Never leaks tokens. */
export async function getPostDetail(postId: string): Promise<AdminPostDetail | null> {
  return prisma.post.findUnique({ where: { id: postId }, select: postDetailSelect });
}

// ─────────────────────────── Connection filtering ───────────────────────────

/**
 * Pure mapping from a parsed connection filter to a Prisma `SocialAccountWhereInput`. No DB
 * calls - unit-testable in isolation. `tokenHealth` needs the current time; `now` is passed
 * in (not read from Date.now()) to keep the builder deterministic for tests. "expired" =
 * `tokenExpiresAt` before `now`; "expiring" = within the next 24h.
 */
export function buildAccountWhere(
  filter: ConnectionListQuery,
  now: Date,
): Prisma.SocialAccountWhereInput {
  const where: Prisma.SocialAccountWhereInput = {};
  const and: Prisma.SocialAccountWhereInput[] = [];

  if (filter.platform) and.push({ platform: filter.platform });
  if (filter.status) and.push({ status: filter.status });

  if (filter.tokenHealth === "expired") {
    and.push({ tokenExpiresAt: { lt: now } });
  } else if (filter.tokenHealth === "expiring") {
    and.push({
      tokenExpiresAt: { gte: now, lte: new Date(now.getTime() + EXPIRING_WINDOW_MS) },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

// ─────────────────────────── Connection reads ───────────────────────────

const connectionSelect = {
  id: true,
  platform: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  status: true,
  tokenExpiresAt: true,
  connectedAt: true,
  disconnectedAt: true,
  user: { select: { id: true, email: true, displayName: true } },
  _count: { select: { targets: { where: { status: "pending" } } } },
} satisfies Prisma.SocialAccountSelect;

export type AdminConnectionListItem = Prisma.SocialAccountGetPayload<{
  select: typeof connectionSelect;
}>;

/** All social accounts across users (newest connected first). NEVER selects encryptedTokens. */
export async function listConnections(
  filter: ConnectionListQuery,
): Promise<AdminConnectionListItem[]> {
  return prisma.socialAccount.findMany({
    where: buildAccountWhere(filter, new Date()),
    select: connectionSelect,
    orderBy: { connectedAt: "desc" },
  });
}

// ─────────────────────────── Mutations ───────────────────────────

interface CancelResult {
  id: string;
  canceledTargets: number;
}

/**
 * Cancel a scheduled/publishing post: remove the queued BullMQ job for each PENDING target,
 * mark those targets `canceled`, and set the post `canceled`. Targets already `success` or
 * `publishing` are left untouched - an honest partial outcome when the worker has already run.
 */
export async function cancelPost(
  actorId: string,
  postId: string,
  reason: string,
): Promise<CancelResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });
  if (!post) throw new AdminActionError(404, "Post not found.");
  if (post.status !== "scheduled" && post.status !== "publishing") {
    throw new AdminActionError(409, "Only scheduled posts can be canceled.");
  }

  const pending = await prisma.postTarget.findMany({
    where: { postId, status: "pending" },
    select: { id: true },
  });
  const pendingIds = pending.map((t) => t.id);

  await removePublishJobs(pendingIds);

  await prisma.$transaction([
    prisma.postTarget.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: "canceled" },
    }),
    prisma.post.update({
      where: { id: postId },
      data: {
        status: "canceled",
        moderatedById: actorId,
        moderatedAt: new Date(),
        moderationReason: reason,
      },
    }),
  ]);

  return { id: postId, canceledTargets: pendingIds.length };
}

/**
 * Takedown a post: mark it `removed` and cancel any remaining `pending` targets (remove their
 * queued jobs + set `canceled`). Already-sent (`success`) targets cannot be un-published -
 * Spanlyfy only relays - so they are left as-is; the UI notes this limitation.
 */
export async function takedownPost(
  actorId: string,
  postId: string,
  reason: string,
): Promise<CancelResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new AdminActionError(404, "Post not found.");

  const pending = await prisma.postTarget.findMany({
    where: { postId, status: "pending" },
    select: { id: true },
  });
  const pendingIds = pending.map((t) => t.id);

  await removePublishJobs(pendingIds);

  await prisma.$transaction([
    prisma.postTarget.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: "canceled" },
    }),
    prisma.post.update({
      where: { id: postId },
      data: {
        status: "removed",
        moderatedById: actorId,
        moderatedAt: new Date(),
        moderationReason: reason,
      },
    }),
  ]);

  return { id: postId, canceledTargets: pendingIds.length };
}

/**
 * Force-disconnect a social account (soft-delete), reusing the user-side disconnect path:
 * set `disconnectedAt` + `status=error` so PostTarget history survives. Guards: 404 if not
 * found, 409 if already disconnected. NEVER logs or exposes `encryptedTokens`.
 */
export async function forceDisconnect(
  actorId: string,
  accountId: string,
  reason: string,
): Promise<{ id: string }> {
  void actorId; // recorded by the route's audit log
  void reason; // recorded by the route's audit log
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    select: { id: true, disconnectedAt: true },
  });
  if (!account) throw new AdminActionError(404, "Account not found.");
  if (account.disconnectedAt) {
    throw new AdminActionError(409, "Account is already disconnected.");
  }

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { disconnectedAt: new Date(), status: "error" },
  });

  return { id: accountId };
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { PostListQuery, ConnectionListQuery } from "@/lib/schemas/admin-content";

// content.ts imports "server-only" (a Next build alias, not a real module in a plain
// vitest run). Stub it. We mock @/server/db so the service runs with no real database,
// and @/server/queue so `removePublishJobs` is a spy we assert on (no BullMQ/Redis).
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const postFindUnique = vi.fn();
const postFindMany = vi.fn();
const postUpdate = vi.fn();
const postTargetFindMany = vi.fn();
const postTargetUpdateMany = vi.fn();
const accountFindUnique = vi.fn();
const accountFindMany = vi.fn();
const accountUpdate = vi.fn();
// $transaction just resolves the array of (already-invoked) operation results.
const txn = vi.fn((ops: unknown[]) => Promise.resolve(ops));

vi.mock("@/server/db", () => ({
  prisma: {
    post: {
      findUnique: (a: unknown) => postFindUnique(a),
      findMany: (a: unknown) => postFindMany(a),
      update: (a: unknown) => postUpdate(a),
    },
    postTarget: {
      findMany: (a: unknown) => postTargetFindMany(a),
      updateMany: (a: unknown) => postTargetUpdateMany(a),
    },
    socialAccount: {
      findUnique: (a: unknown) => accountFindUnique(a),
      findMany: (a: unknown) => accountFindMany(a),
      update: (a: unknown) => accountUpdate(a),
    },
    $transaction: (ops: unknown[]) => txn(ops),
  },
}));

// ─────────────────────────── Queue mock ───────────────────────────
// content.ts imports `removePublishJobs` from @/server/queue; stub it so cancel/takedown
// can assert the exact pending target ids it was handed, with no BullMQ/Redis.
const removePublishJobs = vi.fn();
vi.mock("@/server/queue", () => ({
  removePublishJobs: (ids: string[]) => removePublishJobs(ids),
}));

// Imported after the mocks above are registered.
import {
  buildPostWhere,
  buildAccountWhere,
  listPosts,
  getPostDetail,
  listConnections,
  cancelPost,
  takedownPost,
  forceDisconnect,
  AdminActionError,
} from "./content";
import {
  postListQuerySchema,
  connectionListQuerySchema,
  moderationActionSchema,
} from "@/lib/schemas/admin-content";

beforeEach(() => {
  postFindUnique.mockReset();
  postFindMany.mockReset();
  postUpdate.mockReset();
  postTargetFindMany.mockReset();
  postTargetUpdateMany.mockReset();
  accountFindUnique.mockReset();
  accountFindMany.mockReset();
  accountUpdate.mockReset();
  txn.mockClear();
  removePublishJobs.mockReset();
  removePublishJobs.mockResolvedValue(undefined);
});

/** Run `fn`, returning the thrown value (or throwing if it unexpectedly resolves). */
async function catchThrown<T>(fn: () => Promise<T>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, but it resolved");
}

/** Build a fully-parsed PostListQuery from a partial, supplying the required `take`. */
function postFilter(partial: Partial<PostListQuery> = {}): PostListQuery {
  return { take: 25, ...partial } as PostListQuery;
}

/** The AND array buildPostWhere produces (or `[]` when there are no constraints). */
function postAnd(where: Prisma.PostWhereInput): Prisma.PostWhereInput[] {
  return (where.AND as Prisma.PostWhereInput[] | undefined) ?? [];
}

/** The AND array buildAccountWhere produces (or `[]` when there are no constraints). */
function accountAnd(
  where: Prisma.SocialAccountWhereInput,
): Prisma.SocialAccountWhereInput[] {
  return (where.AND as Prisma.SocialAccountWhereInput[] | undefined) ?? [];
}

// A fixed clock so token-health windows are exact and deterministic.
const NOW = new Date("2026-06-16T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────── buildPostWhere (pure) ───────────────────────────

describe("buildPostWhere (pure → Prisma.PostWhereInput)", () => {
  it("empty filter produces no constraints (no AND key leaks in)", () => {
    const where = buildPostWhere(postFilter());
    expect(where).toEqual({});
    expect(where.AND).toBeUndefined();
  });

  it("status filter → { status }", () => {
    const where = buildPostWhere(postFilter({ status: "scheduled" }));
    expect(postAnd(where)).toContainEqual({ status: "scheduled" });
  });

  it("userId filter → { userId }", () => {
    const where = buildPostWhere(postFilter({ userId: "u_1" }));
    expect(postAnd(where)).toContainEqual({ userId: "u_1" });
  });

  it("platform filter joins through targets → account.platform", () => {
    const where = buildPostWhere(postFilter({ platform: "instagram" }));
    expect(postAnd(where)).toContainEqual({
      targets: { some: { account: { platform: "instagram" } } },
    });
  });

  it("query → mainCaption contains (case-insensitive)", () => {
    const where = buildPostWhere(postFilter({ query: "launch" }));
    expect(postAnd(where)).toContainEqual({
      mainCaption: { contains: "launch", mode: "insensitive" },
    });
  });

  it("from only → createdAt gte (no lte)", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const where = buildPostWhere(postFilter({ from }));
    expect(postAnd(where)).toContainEqual({ createdAt: { gte: from } });
  });

  it("to only → createdAt lte (no gte)", () => {
    const to = new Date("2026-12-31T00:00:00.000Z");
    const where = buildPostWhere(postFilter({ to }));
    expect(postAnd(where)).toContainEqual({ createdAt: { lte: to } });
  });

  it("from + to → createdAt gte and lte together", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-12-31T00:00:00.000Z");
    const where = buildPostWhere(postFilter({ from, to }));
    expect(postAnd(where)).toContainEqual({ createdAt: { gte: from, lte: to } });
  });

  it("combined filters compose under AND without dropping any condition", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const where = buildPostWhere(
      postFilter({
        status: "scheduled",
        userId: "u_1",
        platform: "tiktok",
        query: "needle",
        from,
      }),
    );
    const and = postAnd(where);
    // status(1) + userId(1) + platform(1) + query(1) + createdAt(1) = 5
    expect(and).toHaveLength(5);
    expect(and).toContainEqual({ status: "scheduled" });
    expect(and).toContainEqual({ userId: "u_1" });
    expect(and).toContainEqual({ targets: { some: { account: { platform: "tiktok" } } } });
    expect(and).toContainEqual({ mainCaption: { contains: "needle", mode: "insensitive" } });
    expect(and).toContainEqual({ createdAt: { gte: from } });
  });
});

// ─────────────────────────── buildAccountWhere (pure, injected now) ───────────────────────────

describe("buildAccountWhere (pure → Prisma.SocialAccountWhereInput, injected now)", () => {
  it("empty filter → no token/status/platform constraints", () => {
    const where = buildAccountWhere({}, NOW);
    expect(where).toEqual({});
    expect(where.AND).toBeUndefined();
  });

  it("platform passthrough", () => {
    const where = buildAccountWhere({ platform: "youtube" }, NOW);
    expect(accountAnd(where)).toContainEqual({ platform: "youtube" });
  });

  it("status passthrough", () => {
    const where = buildAccountWhere({ status: "error" }, NOW);
    expect(accountAnd(where)).toContainEqual({ status: "error" });
  });

  it('tokenHealth "expired" → tokenExpiresAt < the injected now (exact boundary)', () => {
    const where = buildAccountWhere({ tokenHealth: "expired" }, NOW);
    expect(accountAnd(where)).toContainEqual({ tokenExpiresAt: { lt: NOW } });
    // Deterministic: the constraint references the SAME injected Date instance.
    const cond = accountAnd(where).find((c) => "tokenExpiresAt" in c) as {
      tokenExpiresAt: { lt: Date };
    };
    expect(cond.tokenExpiresAt.lt).toBe(NOW);
  });

  it('tokenHealth "expiring" → within [now, now+24h] window of the injected now', () => {
    const where = buildAccountWhere({ tokenHealth: "expiring" }, NOW);
    const upper = new Date(NOW.getTime() + DAY_MS);
    expect(accountAnd(where)).toContainEqual({
      tokenExpiresAt: { gte: NOW, lte: upper },
    });
    // Prove the upper bound is exactly 24h after the injected now.
    const cond = accountAnd(where).find((c) => "tokenExpiresAt" in c) as {
      tokenExpiresAt: { gte: Date; lte: Date };
    };
    expect(cond.tokenExpiresAt.gte).toBe(NOW);
    expect(cond.tokenExpiresAt.lte.getTime() - NOW.getTime()).toBe(DAY_MS);
  });

  it("platform + status + tokenHealth compose under AND", () => {
    const where = buildAccountWhere(
      { platform: "x", status: "expired", tokenHealth: "expired" },
      NOW,
    );
    const and = accountAnd(where);
    expect(and).toHaveLength(3);
    expect(and).toContainEqual({ platform: "x" });
    expect(and).toContainEqual({ status: "expired" });
    expect(and).toContainEqual({ tokenExpiresAt: { lt: NOW } });
  });
});

// ─────────────────────────── Reads never select encryptedTokens ───────────────────────────

describe("reads never expose encryptedTokens (security criterion)", () => {
  it("listConnections select omits encryptedTokens", async () => {
    accountFindMany.mockResolvedValue([]);
    await listConnections({});
    const arg = accountFindMany.mock.calls[0][0] as { select: Record<string, unknown> };
    expect("encryptedTokens" in arg.select).toBe(false);
    expect(JSON.stringify(arg.select)).not.toContain("encryptedTokens");
  });

  it("getPostDetail select omits encryptedTokens (incl. nested account select)", async () => {
    postFindUnique.mockResolvedValue(null);
    await getPostDetail("p_1");
    const arg = postFindUnique.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(JSON.stringify(arg.select)).not.toContain("encryptedTokens");
  });

  it("listPosts select omits encryptedTokens", async () => {
    postFindMany.mockResolvedValue([]);
    await listPosts(postFilter());
    const arg = postFindMany.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(JSON.stringify(arg.select)).not.toContain("encryptedTokens");
  });
});

// ─────────────────────────── listPosts pagination ───────────────────────────

describe("listPosts (cursor pagination)", () => {
  it("returns rows with nextCursor=null when fewer than take+1 rows", async () => {
    postFindMany.mockResolvedValue([{ id: "p_1" }, { id: "p_2" }]);
    const result = await listPosts(postFilter({ take: 25 }));
    expect(result.posts).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("pops the lookahead row and surfaces its id as nextCursor", async () => {
    // take=2 → fetch take+1=3; the 3rd row is the lookahead.
    postFindMany.mockResolvedValue([{ id: "p_1" }, { id: "p_2" }, { id: "p_3" }]);
    const result = await listPosts(postFilter({ take: 2 }));
    expect(result.posts.map((p) => p.id)).toEqual(["p_1", "p_2"]);
    expect(result.nextCursor).toBe("p_3");
    const arg = postFindMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(3);
  });
});

// ─────────────────────────── cancelPost ───────────────────────────

describe("cancelPost (guards + partial-outcome honesty)", () => {
  it("throws 404 when the post is missing — no queue/transaction work", async () => {
    postFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => cancelPost("u_admin", "p_x", "spam"));
    expect((err as AdminActionError).status).toBe(404);
    expect(removePublishJobs).not.toHaveBeenCalled();
    expect(txn).not.toHaveBeenCalled();
  });

  it.each(["posted", "draft", "canceled", "removed", "failed"] as const)(
    "throws 409 when status is %s (not cancelable) — never queues or transacts",
    async (status) => {
      postFindUnique.mockResolvedValue({ id: "p_1", status });
      const err = await catchThrown(() => cancelPost("u_admin", "p_1", "spam"));
      expect(err).toBeInstanceOf(AdminActionError);
      expect((err as AdminActionError).status).toBe(409);
      expect(removePublishJobs).not.toHaveBeenCalled();
      expect(txn).not.toHaveBeenCalled();
    },
  );

  it.each(["scheduled", "publishing"] as const)(
    "allows cancel when status is %s",
    async (status) => {
      postFindUnique.mockResolvedValue({ id: "p_1", status });
      postTargetFindMany.mockResolvedValue([{ id: "t_1" }]);
      const result = await cancelPost("u_admin", "p_1", "spam");
      expect(result).toEqual({ id: "p_1", canceledTargets: 1 });
    },
  );

  it("removes jobs for ONLY the pending target ids and leaves success/publishing untouched", async () => {
    postFindUnique.mockResolvedValue({ id: "p_1", status: "scheduled" });
    // The query already filters to pending targets; success/publishing are never returned here.
    postTargetFindMany.mockResolvedValue([{ id: "t_pending_1" }, { id: "t_pending_2" }]);

    const result = await cancelPost("u_admin", "p_1", "abuse");

    // The pending-target query must filter on status: "pending".
    const ptArg = postTargetFindMany.mock.calls[0][0] as {
      where: { postId: string; status: string };
    };
    expect(ptArg.where).toEqual({ postId: "p_1", status: "pending" });

    // removePublishJobs called with exactly the pending ids.
    expect(removePublishJobs).toHaveBeenCalledTimes(1);
    expect(removePublishJobs).toHaveBeenCalledWith(["t_pending_1", "t_pending_2"]);

    // updateMany targets only those pending ids.
    const umArg = postTargetUpdateMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
      data: { status: string };
    };
    expect(umArg.where).toEqual({ id: { in: ["t_pending_1", "t_pending_2"] } });
    expect(umArg.data).toEqual({ status: "canceled" });

    expect(result).toEqual({ id: "p_1", canceledTargets: 2 });
  });

  it("sets the post to canceled with the moderation overlay (moderatedById/At + reason)", async () => {
    postFindUnique.mockResolvedValue({ id: "p_1", status: "scheduled" });
    postTargetFindMany.mockResolvedValue([{ id: "t_1" }]);

    await cancelPost("u_admin", "p_1", "spam content");

    const updArg = postUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: {
        status: string;
        moderatedById: string;
        moderatedAt: Date;
        moderationReason: string;
      };
    };
    expect(updArg.where).toEqual({ id: "p_1" });
    expect(updArg.data.status).toBe("canceled");
    expect(updArg.data.moderatedById).toBe("u_admin");
    expect(updArg.data.moderatedAt).toBeInstanceOf(Date);
    expect(updArg.data.moderationReason).toBe("spam content");
  });

  it("with no pending targets → removePublishJobs([]) and canceledTargets:0", async () => {
    postFindUnique.mockResolvedValue({ id: "p_1", status: "publishing" });
    postTargetFindMany.mockResolvedValue([]);
    const result = await cancelPost("u_admin", "p_1", "race");
    expect(removePublishJobs).toHaveBeenCalledWith([]);
    expect(result.canceledTargets).toBe(0);
  });
});

// ─────────────────────────── takedownPost ───────────────────────────

describe("takedownPost (post → removed, pending canceled, success untouched)", () => {
  it("throws 404 when the post is missing", async () => {
    postFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => takedownPost("u_admin", "p_x", "tos"));
    expect((err as AdminActionError).status).toBe(404);
    expect(removePublishJobs).not.toHaveBeenCalled();
    expect(txn).not.toHaveBeenCalled();
  });

  it("marks the post removed, cancels remaining pending targets, returns audit shape", async () => {
    postFindUnique.mockResolvedValue({ id: "p_1" });
    postTargetFindMany.mockResolvedValue([{ id: "t_pending_1" }]);

    const result = await takedownPost("u_admin", "p_1", "violates tos");

    // Only pending targets are queried (already-success targets stay published, untouched).
    const ptArg = postTargetFindMany.mock.calls[0][0] as {
      where: { postId: string; status: string };
    };
    expect(ptArg.where).toEqual({ postId: "p_1", status: "pending" });

    expect(removePublishJobs).toHaveBeenCalledWith(["t_pending_1"]);

    const updArg = postUpdate.mock.calls[0][0] as {
      data: { status: string; moderatedById: string; moderationReason: string };
    };
    expect(updArg.data.status).toBe("removed");
    expect(updArg.data.moderatedById).toBe("u_admin");
    expect(updArg.data.moderationReason).toBe("violates tos");

    expect(result).toEqual({ id: "p_1", canceledTargets: 1 });
  });

  it("takedown with all targets already success → cancels nothing, post still removed", async () => {
    postFindUnique.mockResolvedValue({ id: "p_1" });
    postTargetFindMany.mockResolvedValue([]); // no pending → nothing to cancel
    const result = await takedownPost("u_admin", "p_1", "tos");
    expect(removePublishJobs).toHaveBeenCalledWith([]);
    expect(result.canceledTargets).toBe(0);
    const updArg = postUpdate.mock.calls[0][0] as { data: { status: string } };
    expect(updArg.data.status).toBe("removed");
  });
});

// ─────────────────────────── forceDisconnect ───────────────────────────

describe("forceDisconnect (soft-delete guards + token safety)", () => {
  it("throws 404 when the account is not found — no update", async () => {
    accountFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => forceDisconnect("u_admin", "acc_x", "abuse"));
    expect((err as AdminActionError).status).toBe(404);
    expect(accountUpdate).not.toHaveBeenCalled();
  });

  it("throws 409 when already disconnected (disconnectedAt set) — no update", async () => {
    accountFindUnique.mockResolvedValue({
      id: "acc_1",
      disconnectedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const err = await catchThrown(() => forceDisconnect("u_admin", "acc_1", "abuse"));
    expect((err as AdminActionError).status).toBe(409);
    expect(accountUpdate).not.toHaveBeenCalled();
  });

  it("soft-deletes: sets disconnectedAt + status=error, returns { id }", async () => {
    accountFindUnique.mockResolvedValue({ id: "acc_1", disconnectedAt: null });
    accountUpdate.mockResolvedValue({ id: "acc_1" });

    const result = await forceDisconnect("u_admin", "acc_1", "abuse");

    const arg = accountUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { disconnectedAt: Date; status: string };
    };
    expect(arg.where).toEqual({ id: "acc_1" });
    expect(arg.data.disconnectedAt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe("error");
    expect(result).toEqual({ id: "acc_1" });
  });

  it("the lookup select never reads encryptedTokens", async () => {
    accountFindUnique.mockResolvedValue({ id: "acc_1", disconnectedAt: null });
    accountUpdate.mockResolvedValue({ id: "acc_1" });
    await forceDisconnect("u_admin", "acc_1", "abuse");
    const arg = accountFindUnique.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(JSON.stringify(arg.select)).not.toContain("encryptedTokens");
  });
});

// ─────────────────────────── Zod: postListQuerySchema ───────────────────────────

describe("postListQuerySchema", () => {
  it("accepts a valid status + platform", () => {
    const parsed = postListQuerySchema.parse({ status: "scheduled", platform: "instagram" });
    expect(parsed.status).toBe("scheduled");
    expect(parsed.platform).toBe("instagram");
  });

  it("rejects an unknown status / platform enum", () => {
    expect(postListQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(postListQuerySchema.safeParse({ platform: "myspace" }).success).toBe(false);
  });

  it("defaults take to 25 and coerces a string take", () => {
    expect(postListQuerySchema.parse({}).take).toBe(25);
    expect(postListQuerySchema.parse({ take: "10" }).take).toBe(10);
  });

  it("rejects take below 1 and above 100 (clamped by min/max)", () => {
    expect(postListQuerySchema.safeParse({ take: "0" }).success).toBe(false);
    expect(postListQuerySchema.safeParse({ take: "101" }).success).toBe(false);
  });

  it("coerces from/to ISO strings to Date instances", () => {
    const parsed = postListQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
    });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(parsed.to).toBeInstanceOf(Date);
    expect((parsed.from as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects a non-ISO from value", () => {
    expect(postListQuerySchema.safeParse({ from: "yesterday" }).success).toBe(false);
  });
});

// ─────────────────────────── Zod: connectionListQuerySchema ───────────────────────────

describe("connectionListQuerySchema", () => {
  it("accepts tokenHealth expired / expiring only", () => {
    expect(connectionListQuerySchema.parse({ tokenHealth: "expired" }).tokenHealth).toBe(
      "expired",
    );
    expect(connectionListQuerySchema.parse({ tokenHealth: "expiring" }).tokenHealth).toBe(
      "expiring",
    );
  });

  it("rejects any other tokenHealth value", () => {
    expect(connectionListQuerySchema.safeParse({ tokenHealth: "healthy" }).success).toBe(false);
    expect(connectionListQuerySchema.safeParse({ tokenHealth: "active" }).success).toBe(false);
  });

  it("rejects unknown platform / status enums", () => {
    expect(connectionListQuerySchema.safeParse({ platform: "myspace" }).success).toBe(false);
    expect(connectionListQuerySchema.safeParse({ status: "frozen" }).success).toBe(false);
  });

  it("accepts an empty object (all optional)", () => {
    expect(connectionListQuerySchema.safeParse({}).success).toBe(true);
  });
});

// ─────────────────────────── Zod: moderationActionSchema ───────────────────────────

describe("moderationActionSchema (reason required)", () => {
  it("rejects an empty / whitespace-only reason", () => {
    expect(moderationActionSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(moderationActionSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(moderationActionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a reason over 500 chars", () => {
    expect(moderationActionSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });

  it("accepts and trims a valid reason", () => {
    expect(moderationActionSchema.parse({ reason: "  spam content  " })).toEqual({
      reason: "spam content",
    });
  });
});

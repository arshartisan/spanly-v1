import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, Role } from "@prisma/client";
import type { UserListQuery } from "@/lib/schemas/admin-users";

// users.ts imports "server-only" (a Next build alias, not a real module here) and,
// transitively via access.ts, "next/navigation". Stub both. We also mock @/server/db
// so the mutation guards run with no real database, and stub the auth/mailer deps that
// users.ts imports at module load (they're not exercised by the branches under test).
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

const findUnique = vi.fn();
const update = vi.fn();
const deleteMany = vi.fn();
vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: (args: unknown) => findUnique(args),
      update: (args: unknown) => update(args),
    },
    session: {
      deleteMany: (args: unknown) => deleteMany(args),
    },
  },
}));

const issueToken = vi.fn();
vi.mock("@/server/auth", () => ({
  issueToken: (...a: unknown[]) => issueToken(...a),
}));

const mailerSend = vi.fn();
vi.mock("@/server/mailer", () => ({
  mailer: { send: (...a: unknown[]) => mailerSend(...a) },
}));

// Imported after the mocks above are registered.
import {
  buildUserWhere,
  suspendUser,
  signOutAllFor,
  AdminActionError,
} from "./users";
import {
  userListQuerySchema,
  suspendSchema,
  noteSchema,
  updateUserSchema,
} from "@/lib/schemas/admin-users";

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  deleteMany.mockReset();
  issueToken.mockReset();
  mailerSend.mockReset();
});

/** Build a fully-parsed UserListQuery from a partial, supplying the required `take`. */
function filter(partial: Partial<UserListQuery> = {}): UserListQuery {
  return { take: 25, ...partial } as UserListQuery;
}

/** The AND array buildUserWhere produces (or `[]` when there are no constraints). */
function andOf(where: Prisma.UserWhereInput): Prisma.UserWhereInput[] {
  return (where.AND as Prisma.UserWhereInput[] | undefined) ?? [];
}

// ─────────────────────────── buildUserWhere (pure) ───────────────────────────

describe("buildUserWhere (pure → Prisma.UserWhereInput)", () => {
  it("empty filter produces no constraints", () => {
    const where = buildUserWhere(filter());
    expect(where).toEqual({});
    expect(where.AND).toBeUndefined();
  });

  it("query → an OR over email/displayName (insensitive contains) + id equals", () => {
    const where = buildUserWhere(filter({ query: "needle" }));
    const and = andOf(where);
    expect(and).toHaveLength(1);
    expect(and[0]).toEqual({
      OR: [
        { email: { contains: "needle", mode: "insensitive" } },
        { displayName: { contains: "needle", mode: "insensitive" } },
        { id: { equals: "needle" } },
      ],
    });
  });

  it("role filter is passed through", () => {
    const where = buildUserWhere(filter({ role: "admin" as Role }));
    expect(andOf(where)).toContainEqual({ role: "admin" });
  });

  it('suspended:"true" → suspendedAt not-null', () => {
    const where = buildUserWhere(filter({ suspended: "true" }));
    expect(andOf(where)).toContainEqual({ suspendedAt: { not: null } });
  });

  it('suspended:"false" → suspendedAt null', () => {
    const where = buildUserWhere(filter({ suspended: "false" }));
    expect(andOf(where)).toContainEqual({ suspendedAt: null });
  });

  it('verified:"true" → emailVerified not-null', () => {
    const where = buildUserWhere(filter({ verified: "true" }));
    expect(andOf(where)).toContainEqual({ emailVerified: { not: null } });
  });

  it('verified:"false" → emailVerified null', () => {
    const where = buildUserWhere(filter({ verified: "false" }));
    expect(andOf(where)).toContainEqual({ emailVerified: null });
  });

  it("plan → nested subscription is { plan }", () => {
    const where = buildUserWhere(filter({ plan: "pro" as UserListQuery["plan"] }));
    expect(andOf(where)).toContainEqual({ subscription: { is: { plan: "pro" } } });
  });

  it("status → nested subscription is { status }", () => {
    const where = buildUserWhere(
      filter({ status: "active" as UserListQuery["status"] }),
    );
    expect(andOf(where)).toContainEqual({ subscription: { is: { status: "active" } } });
  });

  it("plan + status collapse into a single subscription constraint", () => {
    const where = buildUserWhere(
      filter({
        plan: "pro" as UserListQuery["plan"],
        status: "active" as UserListQuery["status"],
      }),
    );
    const subs = andOf(where).filter((c) => "subscription" in c);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toEqual({ subscription: { is: { plan: "pro", status: "active" } } });
  });

  it("combined filters compose under AND without dropping any condition", () => {
    const where = buildUserWhere(
      filter({
        query: "needle",
        role: "support" as Role,
        suspended: "true",
        verified: "false",
        plan: "pro" as UserListQuery["plan"],
        status: "active" as UserListQuery["status"],
      }),
    );
    const and = andOf(where);
    // query(1) + role(1) + suspended(1) + verified(1) + subscription(1) = 5
    expect(and).toHaveLength(5);
    expect(and).toContainEqual({
      OR: [
        { email: { contains: "needle", mode: "insensitive" } },
        { displayName: { contains: "needle", mode: "insensitive" } },
        { id: { equals: "needle" } },
      ],
    });
    expect(and).toContainEqual({ role: "support" });
    expect(and).toContainEqual({ suspendedAt: { not: null } });
    expect(and).toContainEqual({ emailVerified: null });
    expect(and).toContainEqual({ subscription: { is: { plan: "pro", status: "active" } } });
  });
});

// ─────────────────────────── Mutation guards ───────────────────────────

/** Run `fn`, returning the thrown value (or throwing if it unexpectedly resolves). */
async function catchThrown<T>(fn: () => Promise<T>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, but it resolved");
}

interface TargetRow {
  id: string;
  role: Role;
  email: string;
  emailVerified: Date | null;
  suspendedAt: Date | null;
}

function targetRow(over: Partial<TargetRow> = {}): TargetRow {
  return {
    id: "u_target",
    role: "user",
    email: "target@example.com",
    emailVerified: null,
    suspendedAt: null,
    ...over,
  };
}

describe("suspendUser (guards via AdminActionError.status)", () => {
  it("throws 400 when actor === target (cannot suspend self) — never touches the DB", async () => {
    const err = await catchThrown(() => suspendUser("u_self", "u_self", "spam"));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(400);
    // The self-check short-circuits before any lookup/update.
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws 403 when the target is a superadmin", async () => {
    findUnique.mockResolvedValue(targetRow({ id: "u_target", role: "superadmin" }));
    const err = await catchThrown(() => suspendUser("u_admin", "u_target", "abuse"));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws 404 when the target does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const err = await catchThrown(() => suspendUser("u_admin", "u_ghost", "abuse"));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("admin suspending a normal user sets suspendedAt and returns the updated row", async () => {
    findUnique.mockResolvedValue(targetRow({ id: "u_target", role: "user" }));
    const when = new Date("2026-06-16T00:00:00.000Z");
    update.mockResolvedValue({ id: "u_target", suspendedAt: when });

    const result = await suspendUser("u_admin", "u_target", "abuse");

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0] as Prisma.UserUpdateArgs;
    expect(arg.where).toEqual({ id: "u_target" });
    // suspendedAt is set to a real Date (new Date() inside the service).
    expect(arg.data.suspendedAt).toBeInstanceOf(Date);
    expect(arg.data.suspendedAt).toBeTruthy();
    expect(result).toEqual({ id: "u_target", suspendedAt: when });
  });

  it("does not store the reason on the user row (audited by the route, not persisted here)", async () => {
    findUnique.mockResolvedValue(targetRow({ id: "u_target", role: "user" }));
    update.mockResolvedValue({ id: "u_target", suspendedAt: new Date() });
    await suspendUser("u_admin", "u_target", "very specific reason text");
    const arg = update.mock.calls[0][0] as Prisma.UserUpdateArgs;
    expect(JSON.stringify(arg.data)).not.toContain("very specific reason text");
  });
});

describe("signOutAllFor (deletes target sessions, never clears cookies)", () => {
  it("deletes exactly the target's Session rows and returns the revoked count", async () => {
    findUnique.mockResolvedValue(targetRow({ id: "u_target" }));
    deleteMany.mockResolvedValue({ count: 3 });

    const result = await signOutAllFor("u_target");

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "u_target" } });
    expect(result).toEqual({ id: "u_target", sessionsRevoked: 3 });
    // No user.update — it must not mutate the user or any cookie/session state beyond deleteMany.
    expect(update).not.toHaveBeenCalled();
  });

  it("throws 404 (and deletes nothing) when the target is missing", async () => {
    findUnique.mockResolvedValue(null);
    const err = await catchThrown(() => signOutAllFor("u_ghost"));
    expect((err as AdminActionError).status).toBe(404);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── Zod schemas ───────────────────────────

describe("userListQuerySchema", () => {
  it("coerces a string `take` to a number", () => {
    const parsed = userListQuerySchema.parse({ take: "10" });
    expect(parsed.take).toBe(10);
  });

  it("defaults `take` to 25 when omitted", () => {
    expect(userListQuerySchema.parse({}).take).toBe(25);
  });

  it("rejects take below 1 and above 100", () => {
    expect(userListQuerySchema.safeParse({ take: "0" }).success).toBe(false);
    expect(userListQuerySchema.safeParse({ take: "101" }).success).toBe(false);
  });

  it("accepts an empty object (all optionals omitted)", () => {
    expect(userListQuerySchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown enum value for role/suspended", () => {
    expect(userListQuerySchema.safeParse({ role: "wizard" }).success).toBe(false);
    expect(userListQuerySchema.safeParse({ suspended: "maybe" }).success).toBe(false);
  });
});

describe("suspendSchema", () => {
  it("rejects an empty / whitespace-only reason", () => {
    expect(suspendSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(suspendSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  it("accepts a non-empty reason", () => {
    expect(suspendSchema.parse({ reason: "spamming" })).toEqual({ reason: "spamming" });
  });
});

describe("noteSchema", () => {
  it("rejects an empty body", () => {
    expect(noteSchema.safeParse({ body: "" }).success).toBe(false);
    expect(noteSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("rejects a body over 5000 chars", () => {
    expect(noteSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });

  it("accepts a normal note body", () => {
    expect(noteSchema.safeParse({ body: "called the user, resolved" }).success).toBe(true);
  });
});

describe("updateUserSchema", () => {
  it("rejects an empty object (must provide at least one field)", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(updateUserSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("accepts a valid partial (displayName only)", () => {
    expect(updateUserSchema.safeParse({ displayName: "New Name" }).success).toBe(true);
  });

  it("accepts a valid partial (email only)", () => {
    expect(updateUserSchema.safeParse({ email: "new@example.com" }).success).toBe(true);
  });
});

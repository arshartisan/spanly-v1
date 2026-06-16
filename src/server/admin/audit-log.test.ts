import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { AuditLogQuery } from "@/lib/schemas/admin-audit";

// audit-log.ts imports "server-only" (a Next build alias, not a real module in a plain
// vitest run). Stub it. We mock @/server/db so the service runs with no real database.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const auditFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    auditLog: {
      findMany: (a: unknown) => auditFindMany(a),
    },
  },
}));

// Imported after the mocks above are registered.
import { buildAuditWhere, listAuditLogs } from "./audit-log";
import { auditLogQuerySchema } from "@/lib/schemas/admin-audit";

beforeEach(() => {
  auditFindMany.mockReset();
});

/** Build a fully-parsed AuditLogQuery from a partial, supplying the required `take`. */
function auditFilter(partial: Partial<AuditLogQuery> = {}): AuditLogQuery {
  return { take: 50, ...partial } as AuditLogQuery;
}

/** The AND array buildAuditWhere produces (or `[]` when there are no constraints). */
function auditAnd(where: Prisma.AuditLogWhereInput): Prisma.AuditLogWhereInput[] {
  return (where.AND as Prisma.AuditLogWhereInput[] | undefined) ?? [];
}

// ─────────────────────────── buildAuditWhere (pure) ───────────────────────────

describe("buildAuditWhere (pure → Prisma.AuditLogWhereInput)", () => {
  it("empty filter produces no constraints (no AND key leaks in)", () => {
    const where = buildAuditWhere(auditFilter());
    expect(where).toEqual({});
    expect(where.AND).toBeUndefined();
  });

  it("action → case-insensitive contains (NOT exact) so 'user.' matches a namespace", () => {
    const where = buildAuditWhere(auditFilter({ action: "user." }));
    expect(auditAnd(where)).toContainEqual({
      action: { contains: "user.", mode: "insensitive" },
    });
  });

  it("actorId → exact actorId equality", () => {
    const where = buildAuditWhere(auditFilter({ actorId: "u_1" }));
    expect(auditAnd(where)).toContainEqual({ actorId: "u_1" });
  });

  it("actorQuery → actor relation OR over email/displayName (case-insensitive)", () => {
    const where = buildAuditWhere(auditFilter({ actorQuery: "alice" }));
    expect(auditAnd(where)).toContainEqual({
      actor: {
        is: {
          OR: [
            { email: { contains: "alice", mode: "insensitive" } },
            { displayName: { contains: "alice", mode: "insensitive" } },
          ],
        },
      },
    });
  });

  it("targetType → exact targetType", () => {
    const where = buildAuditWhere(auditFilter({ targetType: "user" }));
    expect(auditAnd(where)).toContainEqual({ targetType: "user" });
  });

  it("targetId → exact targetId", () => {
    const where = buildAuditWhere(auditFilter({ targetId: "p_9" }));
    expect(auditAnd(where)).toContainEqual({ targetId: "p_9" });
  });

  it("from only → createdAt gte (no lte)", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const where = buildAuditWhere(auditFilter({ from }));
    expect(auditAnd(where)).toContainEqual({ createdAt: { gte: from } });
  });

  it("to only → createdAt lte (no gte)", () => {
    const to = new Date("2026-12-31T00:00:00.000Z");
    const where = buildAuditWhere(auditFilter({ to }));
    expect(auditAnd(where)).toContainEqual({ createdAt: { lte: to } });
  });

  it("from + to → createdAt gte and lte together", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-12-31T00:00:00.000Z");
    const where = buildAuditWhere(auditFilter({ from, to }));
    expect(auditAnd(where)).toContainEqual({ createdAt: { gte: from, lte: to } });
  });

  it("actorId and actorQuery compose independently (both constraints apply)", () => {
    const where = buildAuditWhere(auditFilter({ actorId: "u_1", actorQuery: "bob" }));
    const and = auditAnd(where);
    expect(and).toContainEqual({ actorId: "u_1" });
    expect(and).toContainEqual({
      actor: {
        is: {
          OR: [
            { email: { contains: "bob", mode: "insensitive" } },
            { displayName: { contains: "bob", mode: "insensitive" } },
          ],
        },
      },
    });
  });

  it("combined filters compose under AND without dropping any condition", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const where = buildAuditWhere(
      auditFilter({
        action: "user.suspend",
        actorQuery: "carol",
        targetType: "user",
        targetId: "u_target",
        from,
      }),
    );
    const and = auditAnd(where);
    // action(1) + actorQuery(1) + targetType(1) + targetId(1) + createdAt(1) = 5
    expect(and).toHaveLength(5);
    expect(and).toContainEqual({ action: { contains: "user.suspend", mode: "insensitive" } });
    expect(and).toContainEqual({ targetType: "user" });
    expect(and).toContainEqual({ targetId: "u_target" });
    expect(and).toContainEqual({ createdAt: { gte: from } });
  });
});

// ─────────────────────────── listAuditLogs ───────────────────────────

describe("listAuditLogs (cursor pagination + security)", () => {
  it("returns entries with nextCursor=null when fewer than take+1 rows", async () => {
    auditFindMany.mockResolvedValue([{ id: "a_1" }, { id: "a_2" }]);
    const result = await listAuditLogs(auditFilter({ take: 50 }));
    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("pops the lookahead row and surfaces its id as nextCursor", async () => {
    // take=2 → fetch take+1=3; the 3rd row is the lookahead.
    auditFindMany.mockResolvedValue([{ id: "a_1" }, { id: "a_2" }, { id: "a_3" }]);
    const result = await listAuditLogs(auditFilter({ take: 2 }));
    expect(result.entries.map((e) => e.id)).toEqual(["a_1", "a_2"]);
    expect(result.nextCursor).toBe("a_3");
    const arg = auditFindMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(3);
  });

  it("orders newest createdAt first", async () => {
    auditFindMany.mockResolvedValue([]);
    await listAuditLogs(auditFilter());
    const arg = auditFindMany.mock.calls[0][0] as { orderBy: { createdAt: string } };
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("applies cursor + skip:1 when a cursor is supplied", async () => {
    auditFindMany.mockResolvedValue([]);
    await listAuditLogs(auditFilter({ cursor: "a_99" }));
    const arg = auditFindMany.mock.calls[0][0] as {
      cursor?: { id: string };
      skip?: number;
    };
    expect(arg.cursor).toEqual({ id: "a_99" });
    expect(arg.skip).toBe(1);
  });

  it("select never reaches actor secrets (no passwordHash / tokens)", async () => {
    auditFindMany.mockResolvedValue([]);
    await listAuditLogs(auditFilter());
    const arg = auditFindMany.mock.calls[0][0] as { select: Record<string, unknown> };
    const serialized = JSON.stringify(arg.select);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("encryptedTokens");
    expect(serialized).not.toContain("token");
    // The actor select is limited to id/email/displayName.
    const actor = arg.select.actor as { select: Record<string, unknown> };
    expect(Object.keys(actor.select).sort()).toEqual(["displayName", "email", "id"]);
  });
});

// ─────────────────────────── Zod: auditLogQuerySchema ───────────────────────────

describe("auditLogQuerySchema", () => {
  it("accepts an empty object (all filters optional) with take defaulting to 50", () => {
    const parsed = auditLogQuerySchema.parse({});
    expect(parsed.take).toBe(50);
    expect(parsed.action).toBeUndefined();
  });

  it("trims and keeps free-text filters", () => {
    const parsed = auditLogQuerySchema.parse({
      action: "  user.suspend  ",
      actorQuery: "  alice  ",
      targetType: "  user  ",
    });
    expect(parsed.action).toBe("user.suspend");
    expect(parsed.actorQuery).toBe("alice");
    expect(parsed.targetType).toBe("user");
  });

  it("coerces a string take and clamps the valid range (1..100)", () => {
    expect(auditLogQuerySchema.parse({ take: "10" }).take).toBe(10);
    expect(auditLogQuerySchema.safeParse({ take: "0" }).success).toBe(false);
    expect(auditLogQuerySchema.safeParse({ take: "101" }).success).toBe(false);
  });

  it("coerces from/to ISO strings to Date instances", () => {
    const parsed = auditLogQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
    });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(parsed.to).toBeInstanceOf(Date);
    expect((parsed.from as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects a non-ISO from value", () => {
    expect(auditLogQuerySchema.safeParse({ from: "yesterday" }).success).toBe(false);
  });
});

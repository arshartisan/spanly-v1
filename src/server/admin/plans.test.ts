import { beforeEach, describe, expect, it, vi } from "vitest";

// plans.ts (admin) imports "server-only" (a Next build alias). Stub it. We mock @/server/db
// so the service runs with no real database, and spy on invalidatePlanCache from
// @/server/plans so we can assert the catalog cache is dropped after every write.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const planFindUnique = vi.fn();
const planFindMany = vi.fn();
const planCreate = vi.fn();
const planUpdate = vi.fn();
const planDelete = vi.fn();
const planCount = vi.fn();
const subGroupBy = vi.fn();
const subCount = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    plan: {
      findUnique: (a: unknown) => planFindUnique(a),
      findMany: (a: unknown) => planFindMany(a),
      create: (a: unknown) => planCreate(a),
      update: (a: unknown) => planUpdate(a),
      delete: (a: unknown) => planDelete(a),
      count: (a: unknown) => planCount(a),
    },
    subscription: {
      groupBy: (a: unknown) => subGroupBy(a),
      count: (a: unknown) => subCount(a),
    },
  },
}));

// Spy on the catalog cache invalidation so we can prove writes drop the cache.
const invalidatePlanCache = vi.fn();
vi.mock("@/server/plans", () => ({
  invalidatePlanCache: () => invalidatePlanCache(),
}));

import {
  listPlansAdmin,
  createPlan,
  updatePlan,
  deletePlan,
  AdminActionError,
} from "./plans";
import { planCreateSchema, planUpdateSchema, defaultsUpdateSchema } from "@/lib/schemas/admin-plans";

beforeEach(() => {
  planFindUnique.mockReset();
  planFindMany.mockReset();
  planCreate.mockReset();
  planUpdate.mockReset();
  planDelete.mockReset();
  planCount.mockReset();
  subGroupBy.mockReset();
  subCount.mockReset();
  invalidatePlanCache.mockReset();
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

/** A fully-valid create input (already in the shape the service expects). */
function createInput(partial: Record<string, unknown> = {}) {
  return {
    key: "starter",
    name: "Starter",
    tagline: "tag",
    monthly: 9,
    yearly: 99,
    accountLimit: 5,
    features: ["a"],
    rank: 0,
    isPublic: true,
    active: true,
    ...partial,
  } as Parameters<typeof createPlan>[1];
}

// ═══════════════════════════ listPlansAdmin ═══════════════════════════

describe("listPlansAdmin (rows + subscriberCount from groupBy; accountLimit stays -1)", () => {
  it("maps the groupBy counts onto each plan; missing → 0; accountLimit not converted", async () => {
    planFindMany.mockResolvedValue([
      { key: "creator", accountLimit: 15 },
      { key: "pro", accountLimit: -1 }, // unlimited stays -1 on the admin row
    ]);
    subGroupBy.mockResolvedValue([{ plan: "creator", _count: { _all: 3 } }]);

    const rows = await listPlansAdmin();

    expect(rows).toEqual([
      { key: "creator", accountLimit: 15, subscriberCount: 3 },
      { key: "pro", accountLimit: -1, subscriberCount: 0 },
    ]);
    // accountLimit -1 is left as -1 (NOT Infinity) — JSON-safe for the UI.
    expect(rows[1].accountLimit).toBe(-1);
  });

  it("orders plans by rank and counts only live statuses (active|trialing|past_due)", async () => {
    planFindMany.mockResolvedValue([]);
    subGroupBy.mockResolvedValue([]);
    await listPlansAdmin();

    expect(planFindMany).toHaveBeenCalledWith({ orderBy: { rank: "asc" } });
    const gbArg = subGroupBy.mock.calls[0][0] as {
      by: string[];
      where: { status: { in: string[] } };
    };
    expect(gbArg.by).toEqual(["plan"]);
    expect(gbArg.where.status.in).toEqual(["active", "trialing", "past_due"]);
  });
});

// ═══════════════════════════ createPlan ═══════════════════════════

describe("createPlan (409 on existing key; success creates + invalidates cache)", () => {
  it("throws 409 when the key already exists — never creates", async () => {
    planFindUnique.mockResolvedValue({ key: "starter" });
    const err = await catchThrown(() => createPlan("u_admin", createInput()));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(409);
    expect(planCreate).not.toHaveBeenCalled();
    expect(invalidatePlanCache).not.toHaveBeenCalled();
  });

  it("creates the plan with the provided fields and invalidates the catalog cache", async () => {
    planFindUnique.mockResolvedValue(null);
    const created = { key: "starter" };
    planCreate.mockResolvedValue(created);

    const result = await createPlan("u_admin", createInput({ accountLimit: -1 }));

    expect(result).toBe(created);
    const arg = planCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.key).toBe("starter");
    expect(arg.data.accountLimit).toBe(-1); // stored as the -1 sentinel, not Infinity
    expect(invalidatePlanCache).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════ updatePlan ═══════════════════════════

describe("updatePlan (404 missing; never writes key; success invalidates cache)", () => {
  it("throws 404 when the plan is missing — never updates", async () => {
    planFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => updatePlan("u_admin", "ghost", { name: "X" }));
    expect((err as AdminActionError).status).toBe(404);
    expect(planUpdate).not.toHaveBeenCalled();
    expect(invalidatePlanCache).not.toHaveBeenCalled();
  });

  it("updates only the provided fields, never the key, and invalidates the cache", async () => {
    planFindUnique.mockResolvedValue({ key: "creator" });
    const updated = { key: "creator", name: "Creator+" };
    planUpdate.mockResolvedValue(updated);

    const result = await updatePlan("u_admin", "creator", { name: "Creator+" });

    expect(result).toBe(updated);
    const arg = planUpdate.mock.calls[0][0] as {
      where: { key: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ key: "creator" });
    expect("key" in arg.data).toBe(false);
    expect(arg.data).toEqual({ name: "Creator+" });
    expect(invalidatePlanCache).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════ deletePlan ═══════════════════════════

describe("deletePlan (404 / 409 subscribers / 409 last-active / success)", () => {
  it("throws 404 when the plan is missing — never deletes", async () => {
    planFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => deletePlan("u_admin", "ghost"));
    expect((err as AdminActionError).status).toBe(404);
    expect(planDelete).not.toHaveBeenCalled();
  });

  it("throws 409 when ANY live subscriber is on the plan — never deletes", async () => {
    planFindUnique.mockResolvedValue({ key: "creator", active: true });
    subCount.mockResolvedValue(2);
    const err = await catchThrown(() => deletePlan("u_admin", "creator"));
    expect((err as AdminActionError).status).toBe(409);
    expect((err as AdminActionError).message).toContain("subscriber");
    expect(planDelete).not.toHaveBeenCalled();
    expect(invalidatePlanCache).not.toHaveBeenCalled();
  });

  it("throws 409 when it's the LAST active plan (no other active tier)", async () => {
    planFindUnique.mockResolvedValue({ key: "creator", active: true });
    subCount.mockResolvedValue(0);
    planCount.mockResolvedValue(0); // no other active plan
    const err = await catchThrown(() => deletePlan("u_admin", "creator"));
    expect((err as AdminActionError).status).toBe(409);
    expect((err as AdminActionError).message).toContain("last active plan");
    expect(planDelete).not.toHaveBeenCalled();
  });

  it("succeeds when no subscribers and other active plans remain — deletes + invalidates", async () => {
    planFindUnique.mockResolvedValue({ key: "creator", active: true });
    subCount.mockResolvedValue(0);
    planCount.mockResolvedValue(1); // another active plan exists
    planDelete.mockResolvedValue({ key: "creator" });

    await deletePlan("u_admin", "creator");

    // The "other active" check excludes the plan being deleted.
    const countArg = planCount.mock.calls[0][0] as {
      where: { active: boolean; key: { not: string } };
    };
    expect(countArg.where).toEqual({ active: true, key: { not: "creator" } });
    expect(planDelete).toHaveBeenCalledWith({ where: { key: "creator" } });
    expect(invalidatePlanCache).toHaveBeenCalledTimes(1);
  });

  it("an INACTIVE plan with no subscribers deletes without the last-active check", async () => {
    planFindUnique.mockResolvedValue({ key: "legacy", active: false });
    subCount.mockResolvedValue(0);
    planDelete.mockResolvedValue({ key: "legacy" });

    await deletePlan("u_admin", "legacy");

    expect(planCount).not.toHaveBeenCalled(); // inactive → skip the last-active guard
    expect(planDelete).toHaveBeenCalledWith({ where: { key: "legacy" } });
  });

  it("counts only live subscriber statuses (active|trialing|past_due)", async () => {
    planFindUnique.mockResolvedValue({ key: "creator", active: true });
    subCount.mockResolvedValue(0);
    planCount.mockResolvedValue(1);
    planDelete.mockResolvedValue({ key: "creator" });
    await deletePlan("u_admin", "creator");
    const arg = subCount.mock.calls[0][0] as {
      where: { plan: string; status: { in: string[] } };
    };
    expect(arg.where.plan).toBe("creator");
    expect(arg.where.status.in).toEqual(["active", "trialing", "past_due"]);
  });
});

// ═══════════════════════════ Zod: planCreateSchema ═══════════════════════════

describe("planCreateSchema (key slug, ranges, defaults)", () => {
  function base(partial: Record<string, unknown> = {}) {
    return { key: "pro", name: "Pro", monthly: 0, yearly: 0, accountLimit: 5, rank: 0, ...partial };
  }

  it("accepts a valid slug key, rejects spaces / empty / leading|trailing hyphen", () => {
    expect(planCreateSchema.safeParse(base({ key: "pro-max" })).success).toBe(true);
    expect(planCreateSchema.safeParse(base({ key: "Pro Max" })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ key: "" })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ key: "-bad" })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ key: "bad-" })).success).toBe(false);
  });

  it("name must be 1–60 chars", () => {
    expect(planCreateSchema.safeParse(base({ name: "" })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ name: "x".repeat(61) })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ name: "x".repeat(60) })).success).toBe(true);
  });

  it("monthly/yearly must be int ≥ 0 (reject negative and float)", () => {
    expect(planCreateSchema.safeParse(base({ monthly: -1 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ monthly: 9.5 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ yearly: -1 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ monthly: 0, yearly: 0 })).success).toBe(true);
  });

  it("accountLimit must be int ≥ -1 (reject -2; accept -1, 0, 100)", () => {
    expect(planCreateSchema.safeParse(base({ accountLimit: -2 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ accountLimit: -1 })).success).toBe(true);
    expect(planCreateSchema.safeParse(base({ accountLimit: 0 })).success).toBe(true);
    expect(planCreateSchema.safeParse(base({ accountLimit: 100 })).success).toBe(true);
    expect(planCreateSchema.safeParse(base({ accountLimit: 1.5 })).success).toBe(false);
  });

  it("features: non-empty strings, capped at 20", () => {
    expect(planCreateSchema.safeParse(base({ features: ["ok"] })).success).toBe(true);
    expect(planCreateSchema.safeParse(base({ features: [""] })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ features: ["   "] })).success).toBe(false);
    expect(
      planCreateSchema.safeParse(base({ features: Array.from({ length: 21 }, () => "f") })).success,
    ).toBe(false);
  });

  it("rank must be int ≥ 0", () => {
    expect(planCreateSchema.safeParse(base({ rank: -1 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ rank: 1.5 })).success).toBe(false);
    expect(planCreateSchema.safeParse(base({ rank: 0 })).success).toBe(true);
  });

  it("defaults: tagline '', features [], isPublic true, active true", () => {
    const parsed = planCreateSchema.parse(base());
    expect(parsed.tagline).toBe("");
    expect(parsed.features).toEqual([]);
    expect(parsed.isPublic).toBe(true);
    expect(parsed.active).toBe(true);
  });
});

// ═══════════════════════════ Zod: planUpdateSchema ═══════════════════════════

describe("planUpdateSchema (no key; everything optional)", () => {
  it("an empty patch is valid (all fields optional)", () => {
    expect(planUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("does NOT accept a key (stripped — immutable)", () => {
    const parsed = planUpdateSchema.parse({ key: "renamed", name: "X" });
    expect("key" in parsed).toBe(false);
    expect(parsed.name).toBe("X");
  });

  it("still enforces constraints when a field is present", () => {
    expect(planUpdateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(planUpdateSchema.safeParse({ monthly: -1 }).success).toBe(false);
    expect(planUpdateSchema.safeParse({ accountLimit: -2 }).success).toBe(false);
    expect(planUpdateSchema.safeParse({ accountLimit: -1 }).success).toBe(true);
  });
});

// ═══════════════════════════ Zod: defaultsUpdateSchema ═══════════════════════════

describe("defaultsUpdateSchema (trial/refund 0–90; signups bool; partial)", () => {
  it("accepts in-range trial/refund and rejects out-of-range", () => {
    expect(defaultsUpdateSchema.safeParse({ trialDays: 0 }).success).toBe(true);
    expect(defaultsUpdateSchema.safeParse({ trialDays: 90 }).success).toBe(true);
    expect(defaultsUpdateSchema.safeParse({ trialDays: 91 }).success).toBe(false);
    expect(defaultsUpdateSchema.safeParse({ trialDays: -1 }).success).toBe(false);
    expect(defaultsUpdateSchema.safeParse({ refundWindowDays: 91 }).success).toBe(false);
    expect(defaultsUpdateSchema.safeParse({ refundWindowDays: -1 }).success).toBe(false);
  });

  it("rejects a non-integer trialDays", () => {
    expect(defaultsUpdateSchema.safeParse({ trialDays: 7.5 }).success).toBe(false);
  });

  it("signupsDefault must be a boolean", () => {
    expect(defaultsUpdateSchema.safeParse({ signupsDefault: true }).success).toBe(true);
    expect(defaultsUpdateSchema.safeParse({ signupsDefault: "yes" }).success).toBe(false);
  });

  it("a partial / empty patch is valid (all optional)", () => {
    expect(defaultsUpdateSchema.safeParse({}).success).toBe(true);
    expect(defaultsUpdateSchema.safeParse({ trialDays: 14 }).success).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// plans.ts imports "server-only" (a Next build alias, not a real module in a plain vitest
// run). Stub it. We mock @/server/db so the DB-backed catalog runs with no real database.
// plans.ts keeps a MODULE-LEVEL in-process cache and reads Date.now() for its TTL, so each
// test re-imports the module fresh (vi.resetModules + dynamic import in beforeEach) to get a
// clean cache, and controls the clock with vi.useFakeTimers() for deterministic TTL/expiry.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const planFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    plan: {
      findMany: (a: unknown) => planFindMany(a),
    },
  },
}));

import { DEFAULT_PLAN_DEFS } from "@/lib/plan-defaults";

// plans.ts' exported surface — re-bound fresh in beforeEach so the module-level cache resets.
type PlansModule = typeof import("./plans");
let plans: PlansModule;

// The TTL inside plans.ts (CACHE_TTL_MS = 20_000). Kept here so TTL-expiry tests can advance
// past it without re-exporting the constant.
const CACHE_TTL_MS = 20_000;
const NOW = new Date("2026-06-16T12:00:00.000Z");

/** A DB Plan row (the -1 sentinel form). Override fields per test. */
function dbRow(partial: Partial<{
  key: string;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  accountLimit: number;
  features: string[];
  rank: number;
  isPublic: boolean;
  active: boolean;
}> = {}) {
  return {
    key: "creator",
    name: "Creator",
    monthly: 29,
    yearly: 319,
    tagline: "tag",
    accountLimit: 15,
    features: ["a"],
    rank: 0,
    isPublic: true,
    active: true,
    ...partial,
  };
}

beforeEach(async () => {
  planFindMany.mockReset();

  // Fresh module → empty cache for every test.
  vi.resetModules();
  plans = await import("./plans");

  // Deterministic clock for the TTL-based cache.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════ PURE: fromDbLimit / toDbLimit (-1 ↔ Infinity) ═══════════════════════════

describe("fromDbLimit / toDbLimit (pure -1 ↔ Infinity mapping)", () => {
  it("fromDbLimit(-1) → Infinity; a finite limit passes through", () => {
    expect(plans.fromDbLimit(-1)).toBe(Infinity);
    expect(plans.fromDbLimit(15)).toBe(15);
    expect(plans.fromDbLimit(0)).toBe(0);
  });

  it("toDbLimit(Infinity) → -1; a finite limit passes through", () => {
    expect(plans.toDbLimit(Infinity)).toBe(-1);
    expect(plans.toDbLimit(15)).toBe(15);
    expect(plans.toDbLimit(0)).toBe(0);
  });

  it("round-trips Infinity and a finite value", () => {
    expect(plans.fromDbLimit(plans.toDbLimit(Infinity))).toBe(Infinity);
    expect(plans.fromDbLimit(plans.toDbLimit(15))).toBe(15);
    expect(plans.toDbLimit(plans.fromDbLimit(-1))).toBe(-1);
    expect(plans.toDbLimit(plans.fromDbLimit(50))).toBe(50);
  });
});

// ═══════════════════════════ getPlanCatalog (map, order, fallback, cache) ═══════════════════════════

describe("getPlanCatalog (DB rows → PlanDef, fallback, never throws)", () => {
  it("maps DB rows to PlanDef, converting accountLimit -1 → Infinity", async () => {
    planFindMany.mockResolvedValue([
      dbRow({ key: "pro", rank: 2, accountLimit: -1, name: "Pro" }),
    ]);
    const catalog = await plans.getPlanCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].key).toBe("pro");
    expect(catalog[0].accountLimit).toBe(Infinity);
  });

  it("queries active plans ordered by rank asc", async () => {
    planFindMany.mockResolvedValue([dbRow()]);
    await plans.getPlanCatalog();
    expect(planFindMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { rank: "asc" },
    });
  });

  it("empty DB → falls back to DEFAULT_PLAN_DEFS (catalog is never empty)", async () => {
    planFindMany.mockResolvedValue([]);
    const catalog = await plans.getPlanCatalog();
    // Identity check against the module's OWN re-export (resetModules gives plans.ts a fresh
    // copy of @/lib/plan-defaults, so the top-level import is a different instance).
    expect(catalog).toBe(plans.DEFAULT_PLAN_DEFS);
    expect(catalog).toStrictEqual(DEFAULT_PLAN_DEFS);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("DB throw → falls back to DEFAULT_PLAN_DEFS (never throws — product keeps working)", async () => {
    planFindMany.mockRejectedValue(new Error("db down"));
    const catalog = await plans.getPlanCatalog();
    expect(catalog).toBe(plans.DEFAULT_PLAN_DEFS);
    expect(catalog).toStrictEqual(DEFAULT_PLAN_DEFS);
  });

  it("a second read within the TTL is served from cache (prisma queried once)", async () => {
    planFindMany.mockResolvedValue([dbRow()]);
    await plans.getPlanCatalog();
    vi.advanceTimersByTime(CACHE_TTL_MS - 1);
    await plans.getPlanCatalog();
    expect(planFindMany).toHaveBeenCalledTimes(1);
  });

  it("after the TTL expires the catalog is re-fetched (prisma queried again)", async () => {
    planFindMany.mockResolvedValue([dbRow()]);
    await plans.getPlanCatalog();
    vi.advanceTimersByTime(CACHE_TTL_MS + 1);
    await plans.getPlanCatalog();
    expect(planFindMany).toHaveBeenCalledTimes(2);
  });

  it("invalidatePlanCache() forces a re-fetch on the next read (within TTL)", async () => {
    planFindMany.mockResolvedValue([dbRow()]);
    await plans.getPlanCatalog();
    plans.invalidatePlanCache();
    await plans.getPlanCatalog();
    expect(planFindMany).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════ getAccountLimit ═══════════════════════════

describe("getAccountLimit (live catalog limit; sane fallback for unknown key)", () => {
  it("returns the catalog limit for a known plan", async () => {
    planFindMany.mockResolvedValue([dbRow({ key: "creator", accountLimit: 15 })]);
    expect(await plans.getAccountLimit("creator")).toBe(15);
  });

  it("returns Infinity for an unlimited (-1) plan", async () => {
    planFindMany.mockResolvedValue([dbRow({ key: "pro", accountLimit: -1 })]);
    expect(await plans.getAccountLimit("pro")).toBe(Infinity);
  });

  it("unknown key → falls back to the Creator-tier limit (never unlimited)", async () => {
    planFindMany.mockResolvedValue([dbRow({ key: "creator", accountLimit: 15 })]);
    // Contract: FALLBACK_ACCOUNT_LIMIT = DEFAULT_PLAN_DEFS[0].accountLimit (Creator, 15).
    expect(await plans.getAccountLimit("ghost")).toBe(DEFAULT_PLAN_DEFS[0].accountLimit);
  });
});

// ═══════════════════════════ getPlanAtLeast / requirePlanGate (the live gate) ═══════════════════════════

describe("getPlanAtLeast (rank comparison off the live catalog)", () => {
  beforeEach(() => {
    planFindMany.mockResolvedValue([
      dbRow({ key: "creator", rank: 0 }),
      dbRow({ key: "growth", rank: 1, name: "Growth" }),
      dbRow({ key: "pro", rank: 2, name: "Pro" }),
    ]);
  });

  it("higher tier satisfies a lower minimum; equal satisfies itself", async () => {
    expect(await plans.getPlanAtLeast("pro", "growth")).toBe(true);
    expect(await plans.getPlanAtLeast("growth", "growth")).toBe(true);
  });

  it("a lower tier does NOT satisfy a higher minimum", async () => {
    expect(await plans.getPlanAtLeast("creator", "pro")).toBe(false);
  });

  it("an unknown plan ranks -1 (lowest) → never satisfies a real minimum", async () => {
    expect(await plans.getPlanAtLeast("ghost", "creator")).toBe(false);
  });
});

describe("requirePlanGate (live enforcement gate — deny path is load-bearing)", () => {
  beforeEach(() => {
    planFindMany.mockResolvedValue([
      dbRow({ key: "creator", rank: 0, name: "Creator" }),
      dbRow({ key: "growth", rank: 1, name: "Growth" }),
      dbRow({ key: "pro", rank: 2, name: "Pro" }),
    ]);
  });

  it("null subscription → 402, never ok", async () => {
    const r = await plans.requirePlanGate(null, "growth");
    expect(r).toEqual({ ok: false, status: 402, error: "No active subscription." });
  });

  it("canceled subscription → 402 even if the plan rank is high enough", async () => {
    const r = await plans.requirePlanGate({ plan: "pro", status: "canceled" }, "growth");
    expect(r).toEqual({ ok: false, status: 402, error: "Subscription canceled." });
  });

  it("below the minimum tier → 402 with the plan NAME from the catalog", async () => {
    const r = await plans.requirePlanGate({ plan: "creator", status: "active" }, "pro");
    expect(r).toEqual({
      ok: false,
      status: 402,
      error: "Requires the Pro plan or higher.",
    });
  });

  it("an unknown current plan → denied (ranks lowest)", async () => {
    const r = await plans.requirePlanGate({ plan: "ghost", status: "active" }, "creator");
    expect(r.ok).toBe(false);
    expect((r as { status: number }).status).toBe(402);
  });

  it("at or above the minimum, active → ok", async () => {
    expect(await plans.requirePlanGate({ plan: "growth", status: "active" }, "growth")).toEqual({
      ok: true,
    });
    expect(await plans.requirePlanGate({ plan: "pro", status: "trialing" }, "creator")).toEqual({
      ok: true,
    });
  });
});

// ═══════════════════════════ getPlanLabel ═══════════════════════════

describe("getPlanLabel (name + status suffix; unknown key → key)", () => {
  beforeEach(() => {
    planFindMany.mockResolvedValue([dbRow({ key: "creator", name: "Creator" })]);
  });

  it("plain name with no status", async () => {
    expect(await plans.getPlanLabel("creator")).toBe("Creator");
  });

  it("appends the status suffix for trialing / past_due / canceled", async () => {
    expect(await plans.getPlanLabel("creator", "trialing")).toBe("Creator — Trial");
    expect(await plans.getPlanLabel("creator", "past_due")).toBe("Creator — Past due");
    expect(await plans.getPlanLabel("creator", "canceled")).toBe("Creator — Canceled");
  });

  it("unknown key → falls back to the raw key", async () => {
    expect(await plans.getPlanLabel("ghost")).toBe("ghost");
    expect(await plans.getPlanLabel("ghost", "trialing")).toBe("ghost — Trial");
  });
});

// ═══════════════════════════ getPlanMap / getPlan ═══════════════════════════

describe("getPlanMap / getPlan (keyed lookups off the live catalog)", () => {
  beforeEach(() => {
    planFindMany.mockResolvedValue([
      dbRow({ key: "creator", accountLimit: 15 }),
      dbRow({ key: "pro", rank: 2, accountLimit: -1, name: "Pro" }),
    ]);
  });

  it("getPlanMap keys defs by plan key with -1 → Infinity applied", async () => {
    const map = await plans.getPlanMap();
    expect(Object.keys(map).sort()).toEqual(["creator", "pro"]);
    expect(map.pro.accountLimit).toBe(Infinity);
  });

  it("getPlan returns the def for a known key, undefined for an unknown one", async () => {
    expect((await plans.getPlan("creator"))?.key).toBe("creator");
    expect(await plans.getPlan("ghost")).toBeUndefined();
  });
});

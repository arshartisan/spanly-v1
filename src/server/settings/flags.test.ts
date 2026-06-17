import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// flags.ts imports "server-only" (a Next build alias, not a real module in a plain vitest
// run). Stub it. We mock @/server/db so the store runs with no real database. flags.ts
// keeps a MODULE-LEVEL in-process cache and reads Date.now() for its TTL, so each test
// re-imports the module fresh (vi.resetModules + dynamic import in beforeEach) to get a
// clean cache, and controls the clock with vi.useFakeTimers() for deterministic TTL/expiry.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const flagFindUnique = vi.fn();
const flagFindMany = vi.fn();
const flagUpsert = vi.fn();
const annFindUnique = vi.fn();
const annFindMany = vi.fn();
const annCreate = vi.fn();
const annUpdate = vi.fn();
const annDeleteMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    featureFlag: {
      findUnique: (a: unknown) => flagFindUnique(a),
      findMany: (a: unknown) => flagFindMany(a),
      upsert: (a: unknown) => flagUpsert(a),
    },
    announcement: {
      findUnique: (a: unknown) => annFindUnique(a),
      findMany: (a: unknown) => annFindMany(a),
      create: (a: unknown) => annCreate(a),
      update: (a: unknown) => annUpdate(a),
      deleteMany: (a: unknown) => annDeleteMany(a),
    },
  },
}));

import {
  flagPatchSchema,
  announcementCreateSchema,
  announcementUpdateSchema,
} from "@/lib/schemas/admin-settings";

// flags.ts' exported surface - re-bound fresh in beforeEach so the module-level cache resets.
type FlagsModule = typeof import("./flags");
let flags: FlagsModule;

// The TTL inside flags.ts (CACHE_TTL_MS = 20_000). Kept here so TTL-expiry tests can advance
// past it without re-exporting the constant.
const CACHE_TTL_MS = 20_000;
const NOW = new Date("2026-06-16T12:00:00.000Z");

beforeEach(async () => {
  flagFindUnique.mockReset();
  flagFindMany.mockReset();
  flagUpsert.mockReset();
  annFindUnique.mockReset();
  annFindMany.mockReset();
  annCreate.mockReset();
  annUpdate.mockReset();
  annDeleteMany.mockReset();

  // Fresh module → empty cache for every test.
  vi.resetModules();
  flags = await import("./flags");

  // Deterministic clock for the TTL-based cache.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
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

// ═══════════════════════════ isEnabled: the default-true safety net ═══════════════════════════
// Acceptance: "unknown flag keys default to enabled" - an absent row must never block the product.

describe("isEnabled (default rule - absent row must never break the product)", () => {
  it("unknown/absent key (prisma → null) → true", async () => {
    flagFindUnique.mockResolvedValue(null);
    expect(await flags.isEnabled("signups")).toBe(true);
  });

  it("a totally unknown key (never seeded) → true", async () => {
    flagFindUnique.mockResolvedValue(null);
    expect(await flags.isEnabled("some-brand-new-key")).toBe(true);
  });

  it("absent maintenance-mode → false (the documented exception)", async () => {
    flagFindUnique.mockResolvedValue(null);
    expect(await flags.isEnabled("maintenance-mode")).toBe(false);
  });

  it("stored enabled:false row → false (kill switch engaged)", async () => {
    flagFindUnique.mockResolvedValue({ key: "publishing", enabled: false, value: null });
    expect(await flags.isEnabled("publishing")).toBe(false);
  });

  it("stored enabled:true row → true", async () => {
    flagFindUnique.mockResolvedValue({ key: "publishing", enabled: true, value: null });
    expect(await flags.isEnabled("publishing")).toBe(true);
  });

  it("a stored maintenance-mode:true row → true (explicit beats the off-default)", async () => {
    flagFindUnique.mockResolvedValue({ key: "maintenance-mode", enabled: true, value: null });
    expect(await flags.isEnabled("maintenance-mode")).toBe(true);
  });
});

// ═══════════════════════════ isEnabled: cache (TTL + write invalidation) ═══════════════════════════
// Acceptance/edge: "short TTL + write-time invalidation so a kill switch takes effect quickly."

describe("isEnabled (in-process cache: TTL + invalidation)", () => {
  it("a second read within the TTL is served from cache (prisma queried once)", async () => {
    flagFindUnique.mockResolvedValue({ key: "publishing", enabled: true, value: null });

    expect(await flags.isEnabled("publishing")).toBe(true);
    // Still inside the TTL - must NOT hit prisma again.
    vi.advanceTimersByTime(CACHE_TTL_MS - 1);
    expect(await flags.isEnabled("publishing")).toBe(true);

    expect(flagFindUnique).toHaveBeenCalledTimes(1);
  });

  it("after the TTL expires the value is re-fetched (prisma queried again)", async () => {
    flagFindUnique.mockResolvedValueOnce({ key: "publishing", enabled: true, value: null });
    expect(await flags.isEnabled("publishing")).toBe(true);

    // Advance PAST the TTL → the cached entry is stale.
    vi.advanceTimersByTime(CACHE_TTL_MS + 1);
    flagFindUnique.mockResolvedValueOnce({ key: "publishing", enabled: false, value: null });
    expect(await flags.isEnabled("publishing")).toBe(false);

    expect(flagFindUnique).toHaveBeenCalledTimes(2);
  });

  it("setFlag invalidates the cache so the kill switch lands on the NEXT read (within TTL)", async () => {
    // Warm the cache: publishing currently ON.
    flagFindUnique.mockResolvedValueOnce({ key: "publishing", enabled: true, value: null });
    expect(await flags.isEnabled("publishing")).toBe(true);

    // Admin flips it OFF via setFlag → cache for that key must be dropped.
    flagUpsert.mockResolvedValue({ key: "publishing", enabled: false, value: null });
    await flags.setFlag("publishing", false, undefined, "u_admin");

    // The very next read (still well within the TTL) must reflect the new value, NOT the cache.
    flagFindUnique.mockResolvedValueOnce({ key: "publishing", enabled: false, value: null });
    expect(await flags.isEnabled("publishing")).toBe(false);

    // Two finds: the warm-up and the post-invalidation re-read.
    expect(flagFindUnique).toHaveBeenCalledTimes(2);
  });

  it("invalidation is key-scoped: setFlag on one key does not force a re-read of another", async () => {
    flagFindUnique.mockResolvedValueOnce({ key: "publishing", enabled: true, value: null });
    flagFindUnique.mockResolvedValueOnce({ key: "signups", enabled: true, value: null });
    expect(await flags.isEnabled("publishing")).toBe(true);
    expect(await flags.isEnabled("signups")).toBe(true);

    flagUpsert.mockResolvedValue({ key: "publishing", enabled: false, value: null });
    await flags.setFlag("publishing", false, undefined, "u_admin");

    // signups was NOT touched → still served from cache (no extra find).
    expect(await flags.isEnabled("signups")).toBe(true);
    expect(flagFindUnique).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════ getFlag / listFlags ═══════════════════════════

describe("getFlag / listFlags (pass-through reads)", () => {
  it("getFlag returns the stored row or null", async () => {
    flagFindUnique.mockResolvedValue(null);
    expect(await flags.getFlag("nope")).toBeNull();

    const row = { key: "api", enabled: true, value: null };
    flagFindUnique.mockResolvedValue(row);
    expect(await flags.getFlag("api")).toBe(row);
  });

  it("listFlags returns rows ordered by key asc", async () => {
    const rows = [{ key: "api" }, { key: "signups" }];
    flagFindMany.mockResolvedValue(rows);
    expect(await flags.listFlags()).toBe(rows);
    expect(flagFindMany).toHaveBeenCalledWith({ orderBy: { key: "asc" } });
  });
});

// ═══════════════════════════ setFlag (upsert + audit description) ═══════════════════════════

describe("setFlag (upsert, returns row, seeds known description)", () => {
  it("upserts with the KNOWN_FLAGS description for a known key and returns the row", async () => {
    const row = { key: "signups", enabled: false, value: null };
    flagUpsert.mockResolvedValue(row);

    const result = await flags.setFlag("signups", false, undefined, "u_admin");

    expect(result).toBe(row);
    const arg = flagUpsert.mock.calls[0][0] as {
      where: { key: string };
      create: { key: string; enabled: boolean; description?: string; updatedById: string };
      update: { enabled: boolean; updatedById: string };
    };
    expect(arg.where).toEqual({ key: "signups" });
    expect(arg.create.enabled).toBe(false);
    expect(arg.create.updatedById).toBe("u_admin");
    expect(arg.update).toEqual({ enabled: false, value: undefined, updatedById: "u_admin" });
    // signups is a KNOWN_FLAG → its description is seeded on create.
    expect(arg.create.description).toBe("Allow new account sign-ups.");
  });

  it("an unknown key upserts with an undefined description (no seed available)", async () => {
    flagUpsert.mockResolvedValue({ key: "mystery", enabled: true, value: null });
    await flags.setFlag("mystery", true, undefined, "u_admin");
    const arg = flagUpsert.mock.calls[0][0] as { create: { description?: string } };
    expect(arg.create.description).toBeUndefined();
  });

  it("passes a structured value through to create + update", async () => {
    flagUpsert.mockResolvedValue({ key: "api", enabled: true, value: { rate: 10 } });
    const value = { rate: 10 } as Prisma.InputJsonValue;
    await flags.setFlag("api", true, value, "u_admin");
    const arg = flagUpsert.mock.calls[0][0] as {
      create: { value: unknown };
      update: { value: unknown };
    };
    expect(arg.create.value).toEqual({ rate: 10 });
    expect(arg.update.value).toEqual({ rate: 10 });
  });
});

// ═══════════════════════════ PURE: matchesAudience ═══════════════════════════
// Pure targeting matcher - fail-closed for an unknown audience (matches no one).

describe("matchesAudience (pure → boolean)", () => {
  const growth = { subscription: { plan: "growth", status: "active" } };
  const trialingCreator = { subscription: { plan: "creator", status: "trialing" } };
  const noSub = { subscription: null };

  it('"all" → true for any user, including a null subscription', () => {
    expect(flags.matchesAudience("all", growth)).toBe(true);
    expect(flags.matchesAudience("all", noSub)).toBe(true);
  });

  it('"trialing" → true only when subscription.status === "trialing"', () => {
    expect(flags.matchesAudience("trialing", trialingCreator)).toBe(true);
    expect(flags.matchesAudience("trialing", growth)).toBe(false);
    expect(flags.matchesAudience("trialing", noSub)).toBe(false);
  });

  it('"plan:growth" → true only for a growth subscriber', () => {
    expect(flags.matchesAudience("plan:growth", growth)).toBe(true);
    expect(flags.matchesAudience("plan:growth", trialingCreator)).toBe(false);
    expect(flags.matchesAudience("plan:growth", noSub)).toBe(false);
  });

  it("matches the EXACT plan, never a different one (no cross-plan leakage)", () => {
    expect(flags.matchesAudience("plan:creator", trialingCreator)).toBe(true);
    expect(flags.matchesAudience("plan:pro", growth)).toBe(false);
  });

  it("malformed/unknown audience → false (fail closed for targeting)", () => {
    expect(flags.matchesAudience("plan:", growth)).toBe(false); // empty plan key ≠ any plan
    expect(flags.matchesAudience("bogus", growth)).toBe(false);
    expect(flags.matchesAudience("", growth)).toBe(false);
  });
});

// ═══════════════════════════ activeAnnouncements (window + audience) ═══════════════════════════
// Acceptance: "an active announcement appears for its audience and window; a past endsAt disappears."
// The store does the active+window filtering in the DB WHERE; the function then filters by
// audience in memory. We assert the WHERE shape AND the in-memory audience filtering.

describe("activeAnnouncements (DB window WHERE + in-memory audience filter)", () => {
  const growthUser = { subscription: { plan: "growth", status: "active" } };

  it("builds an active + within-window WHERE using a current `now`", async () => {
    annFindMany.mockResolvedValue([]);
    await flags.activeAnnouncements(growthUser);

    const arg = annFindMany.mock.calls[0][0] as {
      where: {
        active: boolean;
        AND: Array<{ OR: Array<Record<string, unknown>> }>;
      };
      orderBy: { createdAt: string };
    };
    expect(arg.where.active).toBe(true);
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    // startsAt: null OR <= now ; endsAt: null OR >= now - null bounds keep a window open.
    expect(arg.where.AND).toEqual([
      { OR: [{ startsAt: null }, { startsAt: { lte: NOW } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: NOW } }] },
    ]);
  });

  it("keeps an in-window announcement whose audience matches, drops a non-matching audience", async () => {
    // The DB already returned only active+in-window rows; we exercise the audience filter.
    annFindMany.mockResolvedValue([
      { id: "a_all", audience: "all" },
      { id: "a_growth", audience: "plan:growth" },
      { id: "a_pro", audience: "plan:pro" }, // user is on growth → excluded
      { id: "a_trial", audience: "trialing" }, // user status is active → excluded
    ]);

    const result = await flags.activeAnnouncements(growthUser);
    expect(result.map((a) => a.id)).toEqual(["a_all", "a_growth"]);
  });

  it("a past endsAt row is excluded by the WHERE (never returned by prisma → not in result)", async () => {
    // Simulate the DB honoring the endsAt>=now bound: the past row simply is not returned.
    annFindMany.mockResolvedValue([{ id: "a_current", audience: "all" }]);
    const result = await flags.activeAnnouncements(growthUser);
    expect(result.map((a) => a.id)).toEqual(["a_current"]);
    // And the WHERE we sent would have filtered the past one out.
    const arg = annFindMany.mock.calls[0][0] as {
      where: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    expect(arg.where.AND[1]).toEqual({
      OR: [{ endsAt: null }, { endsAt: { gte: NOW } }],
    });
  });

  it("a null-subscription user only sees `all` announcements", async () => {
    annFindMany.mockResolvedValue([
      { id: "a_all", audience: "all" },
      { id: "a_growth", audience: "plan:growth" },
      { id: "a_trial", audience: "trialing" },
    ]);
    const result = await flags.activeAnnouncements({ subscription: null });
    expect(result.map((a) => a.id)).toEqual(["a_all"]);
  });
});

// ═══════════════════════════ createAnnouncement ═══════════════════════════

describe("createAnnouncement", () => {
  it("creates with the provided fields, defaulting startsAt/endsAt → null and active → true", async () => {
    const created = { id: "a_1" };
    annCreate.mockResolvedValue(created);

    const result = await flags.createAnnouncement(
      { message: "Heads up", severity: "info", audience: "all" },
      "u_admin",
    );

    expect(result).toBe(created);
    const arg = annCreate.mock.calls[0][0] as {
      data: {
        message: string;
        severity: string;
        audience: string;
        startsAt: Date | null;
        endsAt: Date | null;
        active: boolean;
        createdById: string;
      };
    };
    expect(arg.data.message).toBe("Heads up");
    expect(arg.data.startsAt).toBeNull();
    expect(arg.data.endsAt).toBeNull();
    expect(arg.data.active).toBe(true);
    expect(arg.data.createdById).toBe("u_admin");
  });

  it("honors an explicit active:false and a provided window", async () => {
    annCreate.mockResolvedValue({ id: "a_2" });
    const startsAt = new Date("2026-07-01T00:00:00.000Z");
    const endsAt = new Date("2026-07-31T00:00:00.000Z");
    await flags.createAnnouncement(
      { message: "Scheduled", severity: "warning", audience: "trialing", startsAt, endsAt, active: false },
      "u_admin",
    );
    const arg = annCreate.mock.calls[0][0] as {
      data: { startsAt: Date | null; endsAt: Date | null; active: boolean };
    };
    expect(arg.data.startsAt).toBe(startsAt);
    expect(arg.data.endsAt).toBe(endsAt);
    expect(arg.data.active).toBe(false);
  });
});

// ═══════════════════════════ updateAnnouncement ═══════════════════════════

describe("updateAnnouncement (missing id → null; otherwise patch only provided fields)", () => {
  it("returns null when the announcement does not exist - never calls update", async () => {
    annFindUnique.mockResolvedValue(null);
    const result = await flags.updateAnnouncement("a_missing", { active: false });
    expect(result).toBeNull();
    expect(annUpdate).not.toHaveBeenCalled();
  });

  it("patches only the provided fields and returns the updated row", async () => {
    annFindUnique.mockResolvedValue({ id: "a_1" });
    const updated = { id: "a_1", active: false };
    annUpdate.mockResolvedValue(updated);

    const result = await flags.updateAnnouncement("a_1", { active: false });

    expect(result).toBe(updated);
    const arg = annUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "a_1" });
    expect(arg.data).toEqual({ active: false });
  });
});

// ═══════════════════════════ deleteAnnouncement ═══════════════════════════

describe("deleteAnnouncement (returns whether a row was removed)", () => {
  it("returns false when nothing was deleted (count 0)", async () => {
    annDeleteMany.mockResolvedValue({ count: 0 });
    expect(await flags.deleteAnnouncement("a_missing")).toBe(false);
  });

  it("returns true when a row was deleted (count > 0)", async () => {
    annDeleteMany.mockResolvedValue({ count: 1 });
    expect(await flags.deleteAnnouncement("a_1")).toBe(true);
    expect(annDeleteMany).toHaveBeenCalledWith({ where: { id: "a_1" } });
  });
});

// ═══════════════════════════ KNOWN_FLAGS ═══════════════════════════

describe("KNOWN_FLAGS (seed set)", () => {
  it("includes the core flags + one per platform, and maintenance-mode", () => {
    const keys = flags.KNOWN_FLAGS.map((f) => f.key);
    for (const k of ["signups", "publishing", "content-studio", "bulk", "api", "maintenance-mode"]) {
      expect(keys).toContain(k);
    }
    for (const p of ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"]) {
      expect(keys).toContain(`platform.${p}`);
    }
  });
});

// ═══════════════════════════ Zod: flagPatchSchema ═══════════════════════════

describe("flagPatchSchema", () => {
  it("accepts { enabled: boolean } with an optional value", () => {
    expect(flagPatchSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(flagPatchSchema.parse({ enabled: false, value: { rate: 10 } })).toEqual({
      enabled: false,
      value: { rate: 10 },
    });
  });

  it("requires enabled and rejects a non-boolean enabled", () => {
    expect(flagPatchSchema.safeParse({}).success).toBe(false);
    expect(flagPatchSchema.safeParse({ enabled: "true" }).success).toBe(false);
    expect(flagPatchSchema.safeParse({ enabled: 1 }).success).toBe(false);
  });
});

// ═══════════════════════════ Zod: announcementCreateSchema ═══════════════════════════

describe("announcementCreateSchema", () => {
  it("requires a non-empty message (empty / whitespace rejected, trimmed when valid)", () => {
    expect(announcementCreateSchema.safeParse({ message: "" }).success).toBe(false);
    expect(announcementCreateSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(announcementCreateSchema.parse({ message: "  hi  " }).message).toBe("hi");
  });

  it("rejects a message over 500 chars", () => {
    expect(announcementCreateSchema.safeParse({ message: "x".repeat(501) }).success).toBe(false);
    expect(announcementCreateSchema.parse({ message: "x".repeat(500) }).message.length).toBe(500);
  });

  it("severity defaults to 'info' and is restricted to the enum", () => {
    expect(announcementCreateSchema.parse({ message: "m" }).severity).toBe("info");
    expect(announcementCreateSchema.parse({ message: "m", severity: "critical" }).severity).toBe(
      "critical",
    );
    expect(
      announcementCreateSchema.safeParse({ message: "m", severity: "fatal" }).success,
    ).toBe(false);
  });

  it("audience defaults to 'all' and accepts all | trialing | plan:<known plan>", () => {
    expect(announcementCreateSchema.parse({ message: "m" }).audience).toBe("all");
    for (const a of ["all", "trialing", "plan:creator", "plan:growth", "plan:pro"]) {
      expect(announcementCreateSchema.parse({ message: "m", audience: a }).audience).toBe(a);
    }
  });

  it("rejects a malformed audience (empty plan key, bare plan key, random string)", () => {
    for (const a of ["plan:", "creator", "everyone", "growth"]) {
      expect(
        announcementCreateSchema.safeParse({ message: "m", audience: a }).success,
      ).toBe(false);
    }
  });

  it("coerces startsAt/endsAt ISO strings to Date; rejects a non-ISO value", () => {
    const parsed = announcementCreateSchema.parse({
      message: "m",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T00:00:00.000Z",
    });
    expect(parsed.startsAt).toBeInstanceOf(Date);
    expect(parsed.endsAt).toBeInstanceOf(Date);
    expect((parsed.startsAt as Date).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(announcementCreateSchema.safeParse({ message: "m", startsAt: "soon" }).success).toBe(
      false,
    );
  });
});

// ═══════════════════════════ Zod: announcementUpdateSchema ═══════════════════════════

describe("announcementUpdateSchema (all fields optional, incl. active)", () => {
  it("an empty patch is valid (every field optional)", () => {
    expect(announcementUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a lone active toggle", () => {
    expect(announcementUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });

  it("still enforces the field constraints when present (message min, audience grammar, severity enum)", () => {
    expect(announcementUpdateSchema.safeParse({ message: "" }).success).toBe(false);
    expect(announcementUpdateSchema.safeParse({ audience: "plan:" }).success).toBe(false);
    expect(announcementUpdateSchema.safeParse({ severity: "fatal" }).success).toBe(false);
    expect(announcementUpdateSchema.parse({ message: "ok" }).message).toBe("ok");
  });

  it("allows nullable startsAt/endsAt (clearing the window)", () => {
    expect(announcementUpdateSchema.parse({ startsAt: null, endsAt: null })).toEqual({
      startsAt: null,
      endsAt: null,
    });
  });
});

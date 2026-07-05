import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// waitlist.ts imports "server-only" (a Next build alias, not a real module in a plain vitest
// run). Stub it. We mock @/server/db so the store runs with no real database. waitlist.ts
// keeps a MODULE-LEVEL in-process count cache and reads Date.now() for its TTL, so each test
// re-imports the module fresh (vi.resetModules + dynamic import in beforeEach) to get a clean
// cache, and controls the clock with vi.useFakeTimers() for deterministic TTL/expiry.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const entryFindUnique = vi.fn();
const entryCreate = vi.fn();
const entryCount = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    waitlistEntry: {
      findUnique: (a: unknown) => entryFindUnique(a),
      create: (a: unknown) => entryCreate(a),
      count: (a: unknown) => entryCount(a),
    },
  },
}));

// waitlist.ts' exported surface - re-bound fresh in beforeEach so the module-level cache resets.
type WaitlistModule = typeof import("./waitlist");
let waitlist: WaitlistModule;

// The TTL inside waitlist.ts (COUNT_CACHE_TTL_MS = 20_000). Kept here so TTL-expiry tests can
// advance past it without re-exporting the constant.
const COUNT_CACHE_TTL_MS = 20_000;
const NOW = new Date("2026-07-05T12:00:00.000Z");

beforeEach(async () => {
  entryFindUnique.mockReset();
  entryCreate.mockReset();
  entryCount.mockReset();

  // Fresh module → empty count cache for every test.
  vi.resetModules();
  waitlist = await import("./waitlist");

  // Deterministic clock for the TTL-based count cache.
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

// ═══════════════════════════ addToWaitlist: email normalization ═══════════════════════════
// Acceptance: the email is stored normalized (lowercase + trim) so re-submits are idempotent.

describe("addToWaitlist (email normalization)", () => {
  it('normalizes "  Foo@BAR.com " → "foo@bar.com" for both the lookup and the create', async () => {
    entryFindUnique.mockResolvedValue(null);
    entryCreate.mockResolvedValue({ createdAt: NOW });
    entryCount.mockResolvedValue(1);

    await waitlist.addToWaitlist("  Foo@BAR.com ");

    // Lookup uses the normalized email...
    expect(entryFindUnique).toHaveBeenCalledWith({ where: { email: "foo@bar.com" } });
    // ...and so does the create.
    const createArg = entryCreate.mock.calls[0][0] as { data: { email: string } };
    expect(createArg.data.email).toBe("foo@bar.com");
  });

  it("uppercase-only emails still normalize to lowercase", async () => {
    entryFindUnique.mockResolvedValue(null);
    entryCreate.mockResolvedValue({ createdAt: NOW });
    entryCount.mockResolvedValue(1);

    await waitlist.addToWaitlist("USER@EXAMPLE.COM");
    const createArg = entryCreate.mock.calls[0][0] as { data: { email: string } };
    expect(createArg.data.email).toBe("user@example.com");
  });
});

// ═══════════════════════════ addToWaitlist: new email ═══════════════════════════

describe("addToWaitlist (new email → create)", () => {
  it("creates an entry and returns alreadyJoined:false with a 1-indexed position", async () => {
    entryFindUnique.mockResolvedValue(null);
    const createdAt = new Date("2026-07-05T12:00:00.000Z");
    entryCreate.mockResolvedValue({ createdAt });
    // positionOf → count of rows on/before createdAt.
    entryCount.mockResolvedValue(3);

    const result = await waitlist.addToWaitlist("new@example.com");

    expect(result).toEqual({ position: 3, alreadyJoined: false });
    expect(entryCreate).toHaveBeenCalledTimes(1);
    // position is derived by count with a `lte createdAt` bound (createdAt ordering).
    expect(entryCount).toHaveBeenCalledWith({ where: { createdAt: { lte: createdAt } } });
  });

  it("persists ip + source when provided", async () => {
    entryFindUnique.mockResolvedValue(null);
    entryCreate.mockResolvedValue({ createdAt: NOW });
    entryCount.mockResolvedValue(1);

    await waitlist.addToWaitlist("x@example.com", { ip: "1.2.3.4", source: "landing" });
    const createArg = entryCreate.mock.calls[0][0] as {
      data: { ip: string | null; source: string | null };
    };
    expect(createArg.data.ip).toBe("1.2.3.4");
    expect(createArg.data.source).toBe("landing");
  });

  it("defaults ip + source to null when omitted", async () => {
    entryFindUnique.mockResolvedValue(null);
    entryCreate.mockResolvedValue({ createdAt: NOW });
    entryCount.mockResolvedValue(1);

    await waitlist.addToWaitlist("x@example.com");
    const createArg = entryCreate.mock.calls[0][0] as {
      data: { ip: string | null; source: string | null };
    };
    expect(createArg.data.ip).toBeNull();
    expect(createArg.data.source).toBeNull();
  });
});

// ═══════════════════════════ addToWaitlist: existing email (idempotent) ═══════════════════════════
// Acceptance: re-submitting an existing email returns its existing position, never a duplicate.

describe("addToWaitlist (existing email → idempotent)", () => {
  it("returns alreadyJoined:true and does NOT create a duplicate row", async () => {
    const createdAt = new Date("2026-07-01T09:00:00.000Z");
    entryFindUnique.mockResolvedValue({ email: "dup@example.com", createdAt });
    entryCount.mockResolvedValue(7);

    const result = await waitlist.addToWaitlist("Dup@Example.com");

    expect(result).toEqual({ position: 7, alreadyJoined: true });
    expect(entryCreate).not.toHaveBeenCalled();
    // The existing row's createdAt drives the reported position.
    expect(entryCount).toHaveBeenCalledWith({ where: { createdAt: { lte: createdAt } } });
  });
});

// ═══════════════════════════ addToWaitlist: position ordering ═══════════════════════════
// Position is 1-indexed by createdAt: it equals the count of entries on/before this one.

describe("addToWaitlist (position reflects createdAt ordering)", () => {
  it("the first-ever entry is position 1", async () => {
    entryFindUnique.mockResolvedValue(null);
    const createdAt = new Date("2026-07-05T12:00:00.000Z");
    entryCreate.mockResolvedValue({ createdAt });
    entryCount.mockResolvedValue(1); // only one row on/before → position 1

    const result = await waitlist.addToWaitlist("first@example.com");
    expect(result.position).toBe(1);
  });

  it("a later entry gets a higher position (count of on/before rows)", async () => {
    entryFindUnique.mockResolvedValue(null);
    const createdAt = new Date("2026-07-05T13:00:00.000Z");
    entryCreate.mockResolvedValue({ createdAt });
    entryCount.mockResolvedValue(42);

    const result = await waitlist.addToWaitlist("later@example.com");
    expect(result.position).toBe(42);
  });
});

// ═══════════════════════════ addToWaitlist: invalid email (defensive zod) ═══════════════════════════
// The service validates internally as a defensive second check; a bad email throws ZodError
// and never touches the DB write path.

describe("addToWaitlist (invalid email → ZodError, no DB write)", () => {
  it("throws a ZodError for a malformed email and never creates a row", async () => {
    const err = await catchThrown(() => waitlist.addToWaitlist("not-an-email"));
    expect(err).toBeInstanceOf(ZodError);
    expect(entryCreate).not.toHaveBeenCalled();
    expect(entryFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an empty string", async () => {
    const err = await catchThrown(() => waitlist.addToWaitlist("   "));
    expect(err).toBeInstanceOf(ZodError);
    expect(entryCreate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════ waitlistCount (value + cache: TTL + write invalidation) ═══════════════════════════

describe("waitlistCount (count + in-process cache)", () => {
  it("returns the current count from prisma", async () => {
    entryCount.mockResolvedValue(123);
    expect(await waitlist.waitlistCount()).toBe(123);
  });

  it("a second read within the TTL is served from cache (prisma queried once)", async () => {
    entryCount.mockResolvedValue(10);

    expect(await waitlist.waitlistCount()).toBe(10);
    // Still inside the TTL - must NOT hit prisma again.
    vi.advanceTimersByTime(COUNT_CACHE_TTL_MS - 1);
    expect(await waitlist.waitlistCount()).toBe(10);

    expect(entryCount).toHaveBeenCalledTimes(1);
  });

  it("after the TTL expires the count is re-fetched (prisma queried again)", async () => {
    entryCount.mockResolvedValueOnce(10);
    expect(await waitlist.waitlistCount()).toBe(10);

    // Advance PAST the TTL → the cached count is stale.
    vi.advanceTimersByTime(COUNT_CACHE_TTL_MS + 1);
    entryCount.mockResolvedValueOnce(11);
    expect(await waitlist.waitlistCount()).toBe(11);

    expect(entryCount).toHaveBeenCalledTimes(2);
  });

  it("a new enrolment invalidates the cache so the NEXT count read re-fetches (within TTL)", async () => {
    // Warm the count cache.
    entryCount.mockResolvedValueOnce(5);
    expect(await waitlist.waitlistCount()).toBe(5);

    // A new enrolment happens. addToWaitlist calls count() once (for positionOf) then clears
    // the count cache.
    entryFindUnique.mockResolvedValue(null);
    entryCreate.mockResolvedValue({ createdAt: NOW });
    entryCount.mockResolvedValueOnce(6); // positionOf during the create
    await waitlist.addToWaitlist("fresh@example.com");

    // The very next count read (still within the TTL) must re-fetch, NOT serve the stale 5.
    entryCount.mockResolvedValueOnce(6);
    expect(await waitlist.waitlistCount()).toBe(6);
  });

  it("an idempotent re-submit does NOT invalidate the count cache (no new row)", async () => {
    // Warm the count cache.
    entryCount.mockResolvedValueOnce(8);
    expect(await waitlist.waitlistCount()).toBe(8);

    // Existing email → no create, so the count cache must survive.
    entryFindUnique.mockResolvedValue({ email: "dup@example.com", createdAt: NOW });
    entryCount.mockResolvedValueOnce(8); // positionOf for the existing row
    await waitlist.addToWaitlist("dup@example.com");

    // Next count read is still served from the warm cache → no extra count() beyond positionOf.
    expect(await waitlist.waitlistCount()).toBe(8);
    // count() called twice total: the warm-up read + the positionOf during addToWaitlist.
    // The final waitlistCount() was served from cache (no third call).
    expect(entryCount).toHaveBeenCalledTimes(2);
  });
});

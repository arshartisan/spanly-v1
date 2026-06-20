import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingInterval, RefundRequest, SubscriptionStatus } from "@prisma/client";
import type { PlanKey } from "@/server/plans";

// billing.ts imports "server-only" (a Next build alias, not a real module in a plain
// vitest run). Stub it. We mock @/server/db so the service runs with no real database,
// and @/server/billing-config + @/server/polar so we drive `isLiveBilling()` per-test and
// can assert that Polar is NEVER touched in mock mode.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const refundFindUnique = vi.fn();
const refundUpdate = vi.fn();
const refundCreate = vi.fn();
const subFindUnique = vi.fn();
const subUpdate = vi.fn();
const subFindMany = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    refundRequest: {
      findUnique: (a: unknown) => refundFindUnique(a),
      update: (a: unknown) => refundUpdate(a),
      create: (a: unknown) => refundCreate(a),
    },
    subscription: {
      findUnique: (a: unknown) => subFindUnique(a),
      update: (a: unknown) => subUpdate(a),
      findMany: (a: unknown) => subFindMany(a),
    },
    user: {
      findUnique: (a: unknown) => userFindUnique(a),
    },
  },
}));

// ─────────────────────────── Polar mock ───────────────────────────
// `isLiveBilling` is read live on each call inside the service, so toggling the mock's
// return value between tests flips the live/mock branch deterministically. The Polar client is
// exposed via `polar()`; we stub `orders.list` (paginated) and `refunds.create`.
const isLiveBilling = vi.fn<() => boolean>();
const ordersList = vi.fn();
const refundsCreate = vi.fn();

vi.mock("@/server/billing-config", () => ({
  isLiveBilling: () => isLiveBilling(),
}));
vi.mock("@/server/polar", () => ({
  polar: () => ({
    orders: { list: (a: unknown) => ordersList(a) },
    refunds: { create: (a: unknown) => refundsCreate(a) },
  }),
}));

/** Wrap items as a single-page async-iterable, mirroring the SDK's PageIterator. */
function ordersPage(items: unknown[]) {
  return (async function* () {
    yield { result: { items } };
  })();
}

// Imported after the mocks above are registered.
import {
  buildSubscriptionWhere,
  approveRefund,
  denyRefund,
  grantCredit,
  overrideSubscription,
  listPayments,
  AdminActionError,
  type SubscriptionFilter,
} from "./billing";
import { monthlyEquivalentCents } from "./metrics";
import { PLANS } from "@/server/plans";
import {
  staffRefundSchema,
  denyRefundSchema,
  approveRefundSchema,
  overrideSubscriptionSchema,
  grantCreditSchema,
} from "@/lib/schemas/admin-billing";

const PLAN_KEYS: PlanKey[] = ["creator", "growth", "pro"];
const DAY = 86_400_000;

beforeEach(() => {
  refundFindUnique.mockReset();
  refundUpdate.mockReset();
  refundCreate.mockReset();
  subFindUnique.mockReset();
  subUpdate.mockReset();
  subFindMany.mockReset();
  userFindUnique.mockReset();
  isLiveBilling.mockReset();
  ordersList.mockReset();
  refundsCreate.mockReset();
  // Default: mock billing mode unless a test opts into live.
  isLiveBilling.mockReturnValue(false);
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

/** Minimal typed RefundRequest row; override only the fields a test cares about. */
function refundRow(over: Partial<RefundRequest> = {}): RefundRequest {
  return {
    id: "rr_1",
    userId: "u_1",
    subscriptionId: "sub_1",
    amount: 2900,
    reason: "changed my mind",
    status: "pending",
    providerRefundId: null,
    decidedById: null,
    decidedAt: null,
    createdAt: new Date(Date.now() - 1 * DAY), // in-policy (1 day old) by default
    ...over,
  } as RefundRequest;
}

// ─────────────────────────── monthlyEquivalentCents (pure MRR) ───────────────────────────

describe("monthlyEquivalentCents (pure MRR math)", () => {
  it("monthly → plan.monthly * 100 for every plan", () => {
    expect(monthlyEquivalentCents("creator", "month")).toBe(2900);
    expect(monthlyEquivalentCents("growth", "month")).toBe(4900);
    expect(monthlyEquivalentCents("pro", "month")).toBe(9900);
    // And generically against the catalog.
    for (const plan of PLAN_KEYS) {
      expect(monthlyEquivalentCents(plan, "month")).toBe(PLANS[plan].monthly * 100);
    }
  });

  it("yearly → round(plan.yearly * 100 / 12) with the exact rounded values", () => {
    // creator 319*100/12 = 2658.33… → 2658
    expect(monthlyEquivalentCents("creator", "year")).toBe(2658);
    // growth 529*100/12 = 4408.33… → 4408
    expect(monthlyEquivalentCents("growth", "year")).toBe(4408);
    // pro 1069*100/12 = 8908.33… → 8908
    expect(monthlyEquivalentCents("pro", "year")).toBe(8908);
    // And generically.
    for (const plan of PLAN_KEYS) {
      expect(monthlyEquivalentCents(plan, "year")).toBe(
        Math.round((PLANS[plan].yearly * 100) / 12),
      );
    }
  });

  it("yearly equivalent is cheaper than the monthly price for every plan (sanity)", () => {
    for (const plan of PLAN_KEYS) {
      expect(monthlyEquivalentCents(plan, "year")).toBeLessThan(
        monthlyEquivalentCents(plan, "month"),
      );
    }
  });
});

// ─────────────────────────── buildSubscriptionWhere (pure) ───────────────────────────

describe("buildSubscriptionWhere (pure → Prisma.SubscriptionWhereInput)", () => {
  it("empty filter produces no constraints", () => {
    expect(buildSubscriptionWhere({})).toEqual({});
  });

  it("status only", () => {
    expect(buildSubscriptionWhere({ status: "active" })).toEqual({ status: "active" });
  });

  it("plan only", () => {
    expect(buildSubscriptionWhere({ plan: "pro" })).toEqual({ plan: "pro" });
  });

  it("interval only", () => {
    expect(buildSubscriptionWhere({ interval: "year" })).toEqual({ interval: "year" });
  });

  it("combined filters compose without dropping any field", () => {
    const filter: SubscriptionFilter = {
      status: "trialing" as SubscriptionStatus,
      plan: "growth" as PlanKey,
      interval: "month" as BillingInterval,
    };
    expect(buildSubscriptionWhere(filter)).toEqual({
      status: "trialing",
      plan: "growth",
      interval: "month",
    });
  });

  it("ignores undefined fields (no key leaks in)", () => {
    const where = buildSubscriptionWhere({ plan: "creator" });
    expect(where).toEqual({ plan: "creator" });
    expect("status" in where).toBe(false);
    expect("interval" in where).toBe(false);
  });
});

// ─────────────────────────── approveRefund guards ───────────────────────────

describe("approveRefund (guards + mock/live branch)", () => {
  it("throws 409 when the request is not pending - never updates", async () => {
    refundFindUnique.mockResolvedValue(refundRow({ status: "refunded" }));
    const err = await catchThrown(() => approveRefund("u_admin", "rr_1", {}));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(409);
    expect(refundUpdate).not.toHaveBeenCalled();
  });

  it("throws 403 when out of policy (>7d old) and force is false", async () => {
    refundFindUnique.mockResolvedValue(
      refundRow({ createdAt: new Date(Date.now() - 8 * DAY) }),
    );
    const err = await catchThrown(() =>
      approveRefund("u_admin", "rr_1", { force: false }),
    );
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(403);
    expect(refundUpdate).not.toHaveBeenCalled();
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("out-of-policy with force:true (mock mode) → refunded, no Polar, providerRefundId stays null", async () => {
    refundFindUnique.mockResolvedValue(
      refundRow({ createdAt: new Date(Date.now() - 30 * DAY) }),
    );
    refundUpdate.mockImplementation((a: { data: unknown }) => a.data);

    const result = (await approveRefund("u_admin", "rr_1", {
      force: true,
    })) as unknown as RefundRequest;

    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
    const arg = refundUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; providerRefundId: string | null; decidedById: string };
    };
    expect(arg.where).toEqual({ id: "rr_1" });
    expect(arg.data.status).toBe("refunded");
    expect(arg.data.providerRefundId).toBeNull();
    expect(arg.data.decidedById).toBe("u_admin");
    expect(result.status).toBe("refunded");
  });

  it("in-policy mock approve → refunded, decidedBy set, no Polar call", async () => {
    refundFindUnique.mockResolvedValue(refundRow()); // 1 day old, pending
    refundUpdate.mockImplementation((a: { data: unknown }) => a.data);

    await approveRefund("u_admin", "rr_1", {});

    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
    const arg = refundUpdate.mock.calls[0][0] as {
      data: { status: string; decidedById: string; decidedAt: Date };
    };
    expect(arg.data.status).toBe("refunded");
    expect(arg.data.decidedById).toBe("u_admin");
    expect(arg.data.decidedAt).toBeInstanceOf(Date);
  });

  it("LIVE mode with a subscription + a paid order → refunds the order and stores providerRefundId", async () => {
    isLiveBilling.mockReturnValue(true);
    refundFindUnique.mockResolvedValue(refundRow({ amount: 4900 }));
    subFindUnique.mockResolvedValue({ id: "sub_1", providerSubId: "polar_sub_1" });
    ordersList.mockReturnValue(
      ordersPage([{ id: "ord_9", status: "paid", totalAmount: 4900, currency: "usd" }]),
    );
    refundsCreate.mockResolvedValue({ id: "RF-xyz" });
    refundUpdate.mockImplementation((a: { data: unknown }) => a.data);

    const result = (await approveRefund("u_admin", "rr_1", {})) as unknown as RefundRequest;

    // request.amount (cents) is forwarded straight to Polar - no /100 conversion.
    expect(refundsCreate).toHaveBeenCalledWith({
      orderId: "ord_9",
      amount: 4900,
      reason: "customer_request",
    });
    const arg = refundUpdate.mock.calls[0][0] as {
      data: { status: string; providerRefundId: string | null };
    };
    expect(arg.data.status).toBe("refunded");
    expect(arg.data.providerRefundId).toBe("RF-xyz");
    expect(result.providerRefundId).toBe("RF-xyz");
  });

  it("LIVE mode with no Polar subscription → 422, no refund created/updated", async () => {
    isLiveBilling.mockReturnValue(true);
    refundFindUnique.mockResolvedValue(refundRow());
    subFindUnique.mockResolvedValue({ id: "sub_1", providerSubId: null });

    const err = await catchThrown(() => approveRefund("u_admin", "rr_1", {}));
    expect((err as AdminActionError).status).toBe(422);
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(refundUpdate).not.toHaveBeenCalled();
  });

  it("LIVE mode with a subscription but no paid order → 422", async () => {
    isLiveBilling.mockReturnValue(true);
    refundFindUnique.mockResolvedValue(refundRow());
    subFindUnique.mockResolvedValue({ id: "sub_1", providerSubId: "polar_sub_1" });
    ordersList.mockReturnValue(ordersPage([]));

    const err = await catchThrown(() => approveRefund("u_admin", "rr_1", {}));
    expect((err as AdminActionError).status).toBe(422);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(refundUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── denyRefund ───────────────────────────

describe("denyRefund", () => {
  it("throws 409 when not pending - never updates", async () => {
    refundFindUnique.mockResolvedValue(refundRow({ status: "denied" }));
    const err = await catchThrown(() => denyRefund("u_admin", "rr_1", "no"));
    expect((err as AdminActionError).status).toBe(409);
    expect(refundUpdate).not.toHaveBeenCalled();
  });

  it("valid → status denied with decidedBy/At set", async () => {
    refundFindUnique.mockResolvedValue(refundRow());
    refundUpdate.mockImplementation((a: { data: unknown }) => a.data);

    await denyRefund("u_admin", "rr_1", "out of policy");

    const arg = refundUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; decidedById: string; decidedAt: Date };
    };
    expect(arg.where).toEqual({ id: "rr_1" });
    expect(arg.data.status).toBe("denied");
    expect(arg.data.decidedById).toBe("u_admin");
    expect(arg.data.decidedAt).toBeInstanceOf(Date);
  });

  it("does not persist the note on the row (audited by the route)", async () => {
    refundFindUnique.mockResolvedValue(refundRow());
    refundUpdate.mockImplementation((a: { data: unknown }) => a.data);
    await denyRefund("u_admin", "rr_1", "very specific note text");
    const arg = refundUpdate.mock.calls[0][0] as { data: unknown };
    expect(JSON.stringify(arg.data)).not.toContain("very specific note text");
  });
});

// ─────────────────────────── grantCredit / overrideSubscription ───────────────────────────

describe("grantCredit", () => {
  it("mock mode is a recorded no-op that returns ok and never calls Polar", async () => {
    const result = await grantCredit("u_admin", "u_1", 500, "goodwill");
    expect(result).toEqual({ ok: true });
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(subFindUnique).not.toHaveBeenCalled();
  });

  it("live mode is also a recorded no-op (we don't push a Polar balance credit)", async () => {
    isLiveBilling.mockReturnValue(true);

    const result = await grantCredit("u_admin", "u_1", 500, "goodwill");

    expect(result).toEqual({ ok: true });
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
    // No subscription lookup either - it's a pure recorded no-op.
    expect(subFindUnique).not.toHaveBeenCalled();
  });
});

describe("overrideSubscription", () => {
  it("throws 404 when the user has no subscription", async () => {
    subFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() =>
      overrideSubscription("u_admin", "u_1", { plan: "pro" }),
    );
    expect((err as AdminActionError).status).toBe(404);
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("patches only the provided fields and returns the updated sub", async () => {
    subFindUnique.mockResolvedValue({ id: "sub_1" });
    const updated = { id: "sub_1", plan: "pro", status: "active" };
    subUpdate.mockResolvedValue(updated);

    const trialEnd = new Date("2026-07-01T00:00:00.000Z");
    const result = await overrideSubscription("u_admin", "u_1", {
      plan: "pro",
      status: "active" as SubscriptionStatus,
      trialEndsAt: trialEnd,
    });

    expect(subUpdate).toHaveBeenCalledTimes(1);
    const arg = subUpdate.mock.calls[0][0] as {
      where: { userId: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ userId: "u_1" });
    expect(arg.data).toEqual({ plan: "pro", status: "active", trialEndsAt: trialEnd });
    // interval was not provided → must not appear in the patch.
    expect("interval" in arg.data).toBe(false);
    expect(result).toBe(updated);
  });

  it("accepts trialEndsAt: null to clear the trial", async () => {
    subFindUnique.mockResolvedValue({ id: "sub_1" });
    subUpdate.mockImplementation((a: { data: unknown }) => a.data);

    await overrideSubscription("u_admin", "u_1", { trialEndsAt: null });

    const arg = subUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toEqual({ trialEndsAt: null });
    expect("trialEndsAt" in arg.data).toBe(true);
  });
});

// ─────────────────────────── listPayments (mock-mode flag) ───────────────────────────

describe("listPayments", () => {
  it("mock mode returns an empty list flagged mockMode:true, no Polar call", async () => {
    const result = await listPayments();
    expect(result).toEqual({ mockMode: true, payments: [] });
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("live mode without a userId returns empty (payments are per-user)", async () => {
    isLiveBilling.mockReturnValue(true);
    const result = await listPayments();
    expect(result).toEqual({ mockMode: false, payments: [] });
    expect(ordersList).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── Zod schemas ───────────────────────────

describe("staffRefundSchema", () => {
  it("rejects zero / negative amount", () => {
    expect(staffRefundSchema.safeParse({ userId: "u_1", amount: 0, reason: "x" }).success).toBe(
      false,
    );
    expect(
      staffRefundSchema.safeParse({ userId: "u_1", amount: -100, reason: "x" }).success,
    ).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(
      staffRefundSchema.safeParse({ userId: "u_1", amount: 12.5, reason: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty / whitespace-only reason", () => {
    expect(
      staffRefundSchema.safeParse({ userId: "u_1", amount: 100, reason: "" }).success,
    ).toBe(false);
    expect(
      staffRefundSchema.safeParse({ userId: "u_1", amount: 100, reason: "   " }).success,
    ).toBe(false);
  });

  it("accepts a valid staff refund", () => {
    expect(
      staffRefundSchema.safeParse({ userId: "u_1", amount: 2900, reason: "goodwill" })
        .success,
    ).toBe(true);
  });
});

describe("denyRefundSchema", () => {
  it("requires a non-empty note", () => {
    expect(denyRefundSchema.safeParse({}).success).toBe(false);
    expect(denyRefundSchema.safeParse({ note: "" }).success).toBe(false);
    expect(denyRefundSchema.safeParse({ note: "   " }).success).toBe(false);
  });

  it("accepts a real note", () => {
    expect(denyRefundSchema.parse({ note: "out of policy" })).toEqual({
      note: "out of policy",
    });
  });
});

describe("approveRefundSchema", () => {
  it("accepts an empty object", () => {
    expect(approveRefundSchema.parse({})).toEqual({});
  });

  it("accepts { force: true, note }", () => {
    expect(approveRefundSchema.parse({ force: true, note: "exception approved" })).toEqual({
      force: true,
      note: "exception approved",
    });
  });

  it("rejects a non-boolean force", () => {
    expect(approveRefundSchema.safeParse({ force: "yes" }).success).toBe(false);
  });
});

describe("overrideSubscriptionSchema", () => {
  it("parses trialEndsAt ISO string → Date", () => {
    const parsed = overrideSubscriptionSchema.parse({
      trialEndsAt: "2026-07-01T00:00:00.000Z",
    });
    expect(parsed.trialEndsAt).toBeInstanceOf(Date);
    expect((parsed.trialEndsAt as Date).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("accepts trialEndsAt: null", () => {
    const parsed = overrideSubscriptionSchema.parse({ trialEndsAt: null });
    expect(parsed.trialEndsAt).toBeNull();
  });

  it("rejects an empty object (must provide at least one field)", () => {
    expect(overrideSubscriptionSchema.safeParse({}).success).toBe(false);
  });

  it("accepts any non-empty plan key (catalog is dynamic) but rejects an empty one", () => {
    expect(overrideSubscriptionSchema.safeParse({ plan: "platinum" }).success).toBe(true);
    expect(overrideSubscriptionSchema.safeParse({ plan: "" }).success).toBe(false);
  });

  it("accepts a plan-only override", () => {
    expect(overrideSubscriptionSchema.safeParse({ plan: "pro" }).success).toBe(true);
  });
});

describe("grantCreditSchema", () => {
  it("rejects zero / negative amount", () => {
    expect(grantCreditSchema.safeParse({ amount: 0, reason: "x" }).success).toBe(false);
    expect(grantCreditSchema.safeParse({ amount: -5, reason: "x" }).success).toBe(false);
  });

  it("rejects an empty reason", () => {
    expect(grantCreditSchema.safeParse({ amount: 500, reason: "" }).success).toBe(false);
  });

  it("accepts a valid credit", () => {
    expect(grantCreditSchema.safeParse({ amount: 500, reason: "goodwill" }).success).toBe(
      true,
    );
  });
});

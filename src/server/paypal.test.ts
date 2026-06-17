import { describe, expect, it, vi } from "vitest";

// paypal.ts + billing.ts import "server-only" (a Next build alias, not a real module under a
// plain vitest run). Stub it before importing the modules under test.
vi.mock("server-only", () => ({}));

import { planIdFor, planFromPlanId } from "./paypal";
import { mapPaypalStatus, fromPaypalSubscription, type PaypalSubscription } from "./billing";

// These helpers read PAYPAL_PLAN_* env at call time via PLAN_ENV captured at import. We assert
// the mock-mode placeholder behaviour (no env set), which is deterministic and env-independent.

describe("planIdFor / planFromPlanId (mock placeholders, no env)", () => {
  it("planIdFor returns a deterministic mock placeholder when unconfigured", () => {
    expect(planIdFor("creator", "month")).toBe("mock_plan_creator_month");
    expect(planIdFor("pro", "year")).toBe("mock_plan_pro_year");
  });

  it("planFromPlanId round-trips the mock placeholders", () => {
    expect(planFromPlanId("mock_plan_creator_month")).toEqual({ plan: "creator", interval: "month" });
    expect(planFromPlanId("mock_plan_growth_year")).toEqual({ plan: "growth", interval: "year" });
    expect(planFromPlanId("mock_plan_pro_month")).toEqual({ plan: "pro", interval: "month" });
  });

  it("planFromPlanId returns null for an unknown id", () => {
    expect(planFromPlanId("P-UNKNOWN-123")).toBeNull();
    expect(planFromPlanId("mock_plan_platinum_month")).toBeNull();
  });
});

describe("mapPaypalStatus", () => {
  it("maps PayPal statuses to our enum", () => {
    expect(mapPaypalStatus("ACTIVE")).toBe("active");
    expect(mapPaypalStatus("APPROVAL_PENDING")).toBe("trialing");
    expect(mapPaypalStatus("APPROVED")).toBe("trialing");
    expect(mapPaypalStatus("SUSPENDED")).toBe("paused");
    expect(mapPaypalStatus("CANCELLED")).toBe("canceled");
    expect(mapPaypalStatus("EXPIRED")).toBe("canceled");
    expect(mapPaypalStatus("WHATEVER")).toBe("canceled");
  });
});

describe("fromPaypalSubscription", () => {
  const base: PaypalSubscription = {
    id: "I-SUB1",
    plan_id: "mock_plan_creator_month",
    status: "ACTIVE",
    custom_id: "u_1",
    subscriber: { payer_id: "PAYER1" },
    billing_info: { next_billing_time: "2026-07-01T00:00:00.000Z" },
  };

  it("returns null for an unknown plan id", () => {
    expect(fromPaypalSubscription({ ...base, plan_id: "P-UNKNOWN" }, "u_1")).toBeNull();
  });

  it("maps an active subscription with no trial cycle", () => {
    const input = fromPaypalSubscription(base, "u_1");
    expect(input).toMatchObject({
      userId: "u_1",
      plan: "creator",
      interval: "month",
      status: "active",
      trialEndsAt: null,
      providerCustomerId: "PAYER1",
      providerSubId: "I-SUB1",
    });
    expect(input?.currentPeriodEnd?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("treats an active-but-in-trial subscription as trialing with trialEndsAt set", () => {
    const input = fromPaypalSubscription(
      {
        ...base,
        billing_info: {
          next_billing_time: "2026-07-01T00:00:00.000Z",
          cycle_executions: [{ tenure_type: "TRIAL", cycles_remaining: 1 }],
        },
      },
      "u_1",
    );
    expect(input?.status).toBe("trialing");
    expect(input?.trialEndsAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";

// polar.ts + billing.ts import "server-only" (a Next build alias, not a real module under a
// plain vitest run). Stub it before importing the modules under test.
vi.mock("server-only", () => ({}));

import { productIdFor, planFromProductId, isAddonProduct } from "./polar";
import { mapPolarStatus, fromPolarSubscription } from "./billing";

// These helpers read POLAR_PRODUCT_* env at call time via PRODUCT_ENV captured at import. We
// assert the mock-mode placeholder behaviour (no env set), which is deterministic.

describe("productIdFor / planFromProductId (mock placeholders, no env)", () => {
  it("productIdFor returns a deterministic mock placeholder when unconfigured", () => {
    expect(productIdFor("creator", "month")).toBe("mock_product_creator_month");
    expect(productIdFor("pro", "year")).toBe("mock_product_pro_year");
  });

  it("planFromProductId round-trips the mock placeholders", () => {
    expect(planFromProductId("mock_product_creator_month")).toEqual({
      plan: "creator",
      interval: "month",
    });
    expect(planFromProductId("mock_product_growth_year")).toEqual({
      plan: "growth",
      interval: "year",
    });
    expect(planFromProductId("mock_product_pro_month")).toEqual({
      plan: "pro",
      interval: "month",
    });
  });

  it("planFromProductId returns null for an unknown id", () => {
    expect(planFromProductId("prod_unknown_123")).toBeNull();
    expect(planFromProductId("mock_product_platinum_month")).toBeNull();
  });
});

describe("isAddonProduct", () => {
  it("recognizes the mock add-on placeholder and ignores others", () => {
    expect(isAddonProduct("mock_product_api_addon")).toBe(true);
    expect(isAddonProduct("mock_product_creator_month")).toBe(false);
    expect(isAddonProduct(null)).toBe(false);
    expect(isAddonProduct(undefined)).toBe(false);
  });
});

describe("mapPolarStatus", () => {
  it("maps Polar statuses to our enum", () => {
    expect(mapPolarStatus("active")).toBe("active");
    expect(mapPolarStatus("trialing")).toBe("trialing");
    expect(mapPolarStatus("incomplete")).toBe("trialing");
    expect(mapPolarStatus("past_due")).toBe("past_due");
    expect(mapPolarStatus("unpaid")).toBe("paused");
    expect(mapPolarStatus("canceled")).toBe("canceled");
    expect(mapPolarStatus("incomplete_expired")).toBe("canceled");
    expect(mapPolarStatus("whatever")).toBe("canceled");
  });
});

describe("fromPolarSubscription", () => {
  /** Minimal Polar subscription; override only the fields a test cares about. */
  function polarSub(over: Partial<PolarSubscription> = {}): PolarSubscription {
    return {
      id: "polar_sub_1",
      productId: "mock_product_creator_month",
      status: "active",
      currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      customerId: "cus_1",
      customer: { id: "cus_1", externalId: "u_1" },
      ...over,
    } as PolarSubscription;
  }

  it("returns null for an unknown product id", () => {
    expect(fromPolarSubscription(polarSub({ productId: "prod_unknown" }), "u_1")).toBeNull();
  });

  it("maps an active subscription with no trial", () => {
    const input = fromPolarSubscription(polarSub(), "u_1");
    expect(input).toMatchObject({
      userId: "u_1",
      plan: "creator",
      interval: "month",
      status: "active",
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      providerCustomerId: "cus_1",
      providerSubId: "polar_sub_1",
    });
    expect(input?.currentPeriodEnd?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("treats a trialing subscription as trialing with trialEndsAt = period end", () => {
    const input = fromPolarSubscription(polarSub({ status: "trialing" }), "u_1");
    expect(input?.status).toBe("trialing");
    expect(input?.trialEndsAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("passes through cancelAtPeriodEnd", () => {
    const input = fromPolarSubscription(polarSub({ cancelAtPeriodEnd: true }), "u_1");
    expect(input?.cancelAtPeriodEnd).toBe(true);
  });
});

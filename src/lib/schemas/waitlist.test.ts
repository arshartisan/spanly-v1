import { describe, expect, it } from "vitest";
import { waitlistJoinSchema } from "./waitlist";

// Zod schema shared by the public POST /api/waitlist handler and the landing form. It is the
// request-boundary guard, so cover both boundary and negative cases.

describe("waitlistJoinSchema", () => {
  it("accepts a bare valid email (source optional)", () => {
    const parsed = waitlistJoinSchema.parse({ email: "user@example.com" });
    expect(parsed).toEqual({ email: "user@example.com" });
    expect(parsed.source).toBeUndefined();
  });

  it("accepts an email with an optional source", () => {
    expect(waitlistJoinSchema.parse({ email: "user@example.com", source: "landing" })).toEqual({
      email: "user@example.com",
      source: "landing",
    });
  });

  it("rejects a missing email", () => {
    expect(waitlistJoinSchema.safeParse({}).success).toBe(false);
    expect(waitlistJoinSchema.safeParse({ source: "landing" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    for (const email of ["not-an-email", "foo@", "@bar.com", "", "   "]) {
      expect(waitlistJoinSchema.safeParse({ email }).success).toBe(false);
    }
  });

  it("rejects a non-string email", () => {
    expect(waitlistJoinSchema.safeParse({ email: 123 }).success).toBe(false);
    expect(waitlistJoinSchema.safeParse({ email: null }).success).toBe(false);
  });

  it("rejects an empty source (min 1) and an over-long source (max 60)", () => {
    expect(waitlistJoinSchema.safeParse({ email: "user@example.com", source: "" }).success).toBe(
      false,
    );
    expect(
      waitlistJoinSchema.safeParse({ email: "user@example.com", source: "x".repeat(61) }).success,
    ).toBe(false);
    // Boundary: exactly 60 chars is accepted.
    expect(
      waitlistJoinSchema.safeParse({ email: "user@example.com", source: "x".repeat(60) }).success,
    ).toBe(true);
  });
});

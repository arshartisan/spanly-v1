import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// auth-oauth-state.ts imports "server-only" (a Next build alias, not a real module under a plain
// vitest run). Stub it. The HMAC keys off NEXTAUTH_SECRET and the TTL reads Date.now(), so we
// set the secret and drive the clock with fake timers for deterministic expiry tests.
vi.mock("server-only", () => ({}));

import { signAuthState, verifyAuthState } from "./auth-oauth-state";

const NOW = new Date("2026-06-17T12:00:00.000Z");
const STATE_TTL_MS = 10 * 60 * 1000;

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signAuthState / verifyAuthState", () => {
  it("round-trips the `next` path", () => {
    const state = verifyAuthState(signAuthState({ next: "/settings" }));
    expect(state?.next).toBe("/settings");
  });

  it("round-trips without a `next` (undefined)", () => {
    const state = verifyAuthState(signAuthState({}));
    expect(state).not.toBeNull();
    expect(state?.next).toBeUndefined();
  });

  it("rejects a tampered payload (mac no longer matches)", () => {
    const mac = signAuthState({ next: "/a" }).split(".")[1];
    const forged = Buffer.from(
      JSON.stringify({ next: "/evil", nonce: "x", exp: Date.now() + STATE_TTL_MS }),
    ).toString("base64url");
    expect(verifyAuthState(`${forged}.${mac}`)).toBeNull();
  });

  it("rejects a signature made with a different secret", () => {
    const token = signAuthState({ next: "/a" });
    process.env.NEXTAUTH_SECRET = "a-different-secret";
    expect(verifyAuthState(token)).toBeNull();
  });

  it("rejects an expired token (past the 10-minute TTL)", () => {
    const token = signAuthState({ next: "/a" });
    vi.advanceTimersByTime(STATE_TTL_MS + 1);
    expect(verifyAuthState(token)).toBeNull();
  });

  it("rejects malformed / empty input", () => {
    expect(verifyAuthState(null)).toBeNull();
    expect(verifyAuthState(undefined)).toBeNull();
    expect(verifyAuthState("")).toBeNull();
    expect(verifyAuthState("no-dot-separator")).toBeNull();
  });
});

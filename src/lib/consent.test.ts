import { describe, expect, it } from "vitest";
import {
  ALL_GRANTED,
  CONSENT_VERSION,
  NECESSARY_ONLY,
  parseConsentCookie,
  serializeConsentCookie,
} from "./consent";

describe("consent cookie", () => {
  const now = "2026-06-17T00:00:00.000Z";

  it("round-trips a granted choice", () => {
    const raw = serializeConsentCookie(ALL_GRANTED, now);
    const record = parseConsentCookie(raw);
    expect(record).toEqual({
      v: CONSENT_VERSION,
      categories: { necessary: true, analytics: true },
      updatedAt: now,
    });
  });

  it("round-trips a reject-non-essential choice", () => {
    const record = parseConsentCookie(serializeConsentCookie(NECESSARY_ONLY, now));
    expect(record?.categories).toEqual({ necessary: true, analytics: false });
  });

  it("always forces necessary on, even if a tampered cookie sets it false", () => {
    const tampered = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION, categories: { necessary: false, analytics: true }, updatedAt: now }),
    );
    expect(parseConsentCookie(tampered)?.categories.necessary).toBe(true);
  });

  it("treats missing / empty values as no decision", () => {
    expect(parseConsentCookie(undefined)).toBeNull();
    expect(parseConsentCookie(null)).toBeNull();
    expect(parseConsentCookie("")).toBeNull();
  });

  it("treats malformed JSON as no decision (re-ask) rather than throwing", () => {
    expect(parseConsentCookie("not-json")).toBeNull();
    expect(parseConsentCookie(encodeURIComponent(JSON.stringify({ foo: "bar" })))).toBeNull();
  });

  it("treats a superseded schema version as no decision so we re-prompt", () => {
    const old = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION + 1, categories: { necessary: true, analytics: true }, updatedAt: now }),
    );
    expect(parseConsentCookie(old)).toBeNull();
  });

  it("coerces non-boolean analytics to false (deny by default)", () => {
    const weird = encodeURIComponent(
      JSON.stringify({ v: CONSENT_VERSION, categories: { necessary: true, analytics: "yes" }, updatedAt: now }),
    );
    expect(parseConsentCookie(weird)?.categories.analytics).toBe(false);
  });
});

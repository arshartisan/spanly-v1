import { describe, expect, it } from "vitest";
import { getProvider } from "@/providers/registry";
import { FacebookProvider } from "@/providers/facebook";

describe("MockProvider (registry)", () => {
  it("returns a provider for every platform in mock mode", () => {
    for (const p of ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"] as const) {
      expect(getProvider(p).platform).toBe(p);
    }
  });

  it("validate rejects an over-limit caption for X (max 280)", () => {
    const res = getProvider("x").validate({
      type: "text",
      caption: "x".repeat(300),
      media: [],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/280/);
  });

  it("validate enforces story = exactly one media (Instagram only)", () => {
    const ig = getProvider("instagram");
    expect(ig.validate({ type: "story", caption: "", media: [] }).ok).toBe(false);
    expect(
      ig.validate({ type: "story", caption: "", media: [{ kind: "image", url: "u", order: 0 }] }).ok,
    ).toBe(true);
  });

  it("validate rejects unsupported type (story on X)", () => {
    const res = getProvider("x").validate({
      type: "story",
      caption: "",
      media: [{ kind: "image", url: "u", order: 0 }],
    });
    expect(res.ok).toBe(false);
  });

  it("publish succeeds by default and is deterministic by idempotencyKey", async () => {
    const r = await getProvider("facebook").publish(
      { type: "text", caption: "hello", media: [], idempotencyKey: "post1:acc1" },
      { accessToken: "t", scopes: [] },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.externalPostId).toContain("post1:acc1");
  });

  it("publish fails for platforms listed in MOCK_FAIL_PLATFORMS", async () => {
    process.env.MOCK_FAIL_PLATFORMS = "tiktok";
    const r = await getProvider("tiktok").publish(
      { type: "video", caption: "v", media: [{ kind: "video", url: "u", order: 0 }], idempotencyKey: "p:a" },
      { accessToken: "t", scopes: [] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
    process.env.MOCK_FAIL_PLATFORMS = "";
  });
});

describe("FacebookProvider (live)", () => {
  const fb = new FacebookProvider();

  it("getAuthUrl points at the FB OAuth dialog with comma-separated scopes and state", () => {
    process.env.FACEBOOK_CLIENT_ID = "fb-test-id";
    const url = new URL(fb.getAuthUrl({ state: "csrf123", redirectUri: "https://app/cb" }));
    expect(url.origin + url.pathname).toContain("facebook.com");
    expect(url.pathname).toContain("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("fb-test-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
    expect(url.searchParams.get("state")).toBe("csrf123");
    // Facebook expects comma-separated scopes, not space-separated.
    expect(url.searchParams.get("scope")).toMatch(/pages_manage_posts/);
    expect(url.searchParams.get("scope")).toContain(",");
  });

  it("getAuthUrl throws when FACEBOOK_CLIENT_ID is unset", () => {
    delete process.env.FACEBOOK_CLIENT_ID;
    expect(() => fb.getAuthUrl({ state: "s", redirectUri: "r" })).toThrow(/FACEBOOK_CLIENT_ID/);
  });

  it("validate rejects an over-limit caption (max 5000)", () => {
    const res = fb.validate({ type: "text", caption: "x".repeat(5001), media: [] });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/5000/);
  });

  it("validate rejects image posts with no media", () => {
    expect(fb.validate({ type: "image", caption: "hi", media: [] }).ok).toBe(false);
  });

  it("validate accepts a well-formed text post", () => {
    expect(fb.validate({ type: "text", caption: "hello", media: [] }).ok).toBe(true);
  });
});

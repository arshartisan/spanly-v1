import { describe, expect, it } from "vitest";
import { getProvider } from "@/providers/registry";
import { FacebookProvider } from "@/providers/facebook";
import { InstagramProvider } from "@/providers/instagram";
import { TiktokProvider } from "@/providers/tiktok";
import { YoutubeProvider } from "@/providers/youtube";

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
    // youtube is still mock-backed (tiktok/instagram/linkedin are always-live).
    process.env.MOCK_FAIL_PLATFORMS = "youtube";
    const r = await getProvider("youtube").publish(
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

describe("InstagramProvider (live)", () => {
  const ig = new InstagramProvider();

  it("getAuthUrl (instagram login) points at instagram.com/oauth/authorize with publish scope", () => {
    process.env.INSTAGRAM_CLIENT_ID = "ig-test-id";
    const url = new URL(ig.getAuthUrl({ state: "csrf123", redirectUri: "https://app/cb", method: "instagram" }));
    expect(url.hostname).toContain("instagram.com");
    expect(url.pathname).toContain("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("ig-test-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
    expect(url.searchParams.get("state")).toBe("csrf123");
    expect(url.searchParams.get("scope")).toMatch(/instagram_business_content_publish/);
  });

  it("getAuthUrl defaults to the instagram-login path when no method is given", () => {
    process.env.INSTAGRAM_CLIENT_ID = "ig-test-id";
    const url = new URL(ig.getAuthUrl({ state: "s", redirectUri: "https://app/cb" }));
    expect(url.hostname).toContain("instagram.com");
  });

  it("getAuthUrl (facebook login) points at the FB dialog with FACEBOOK_CLIENT_ID", () => {
    process.env.FACEBOOK_CLIENT_ID = "fb-test-id";
    const url = new URL(ig.getAuthUrl({ state: "s", redirectUri: "https://app/cb", method: "facebook" }));
    expect(url.origin + url.pathname).toContain("facebook.com");
    expect(url.pathname).toContain("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("fb-test-id");
    expect(url.searchParams.get("scope")).toMatch(/instagram_content_publish/);
  });

  it("getAuthUrl throws when INSTAGRAM_CLIENT_ID is unset", () => {
    delete process.env.INSTAGRAM_CLIENT_ID;
    expect(() => ig.getAuthUrl({ state: "s", redirectUri: "r", method: "instagram" })).toThrow(
      /INSTAGRAM_CLIENT_ID/,
    );
  });

  it("validate enforces story = exactly one media", () => {
    expect(ig.validate({ type: "story", caption: "", media: [] }).ok).toBe(false);
    expect(
      ig.validate({ type: "story", caption: "", media: [{ kind: "image", url: "u", order: 0 }] }).ok,
    ).toBe(true);
  });

  it("validate rejects an over-limit caption (max 2200)", () => {
    const res = ig.validate({
      type: "image",
      caption: "x".repeat(2201),
      media: [{ kind: "image", url: "u", order: 0 }],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/2200/);
  });

  it("validate rejects text posts (unsupported on Instagram)", () => {
    expect(ig.validate({ type: "text", caption: "hi", media: [] }).ok).toBe(false);
  });
});

describe("TiktokProvider (live)", () => {
  const tt = new TiktokProvider();

  it("getAuthUrl points at the TikTok authorize endpoint with PKCE + comma scopes", () => {
    process.env.TIKTOK_CLIENT_KEY = "tt-test-key";
    process.env.NEXTAUTH_SECRET ??= "test-secret";
    const url = new URL(tt.getAuthUrl({ state: "csrf123", redirectUri: "https://app/cb" }));
    expect(url.origin + url.pathname).toContain("tiktok.com/v2/auth/authorize");
    expect(url.searchParams.get("client_key")).toBe("tt-test-key");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
    expect(url.searchParams.get("state")).toBe("csrf123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    // TikTok expects comma-separated scopes, not space-separated.
    expect(url.searchParams.get("scope")).toMatch(/video\.publish/);
    expect(url.searchParams.get("scope")).toContain(",");
  });

  it("getAuthUrl throws when TIKTOK_CLIENT_KEY is unset", () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    expect(() => tt.getAuthUrl({ state: "s", redirectUri: "r" })).toThrow(/TIKTOK_CLIENT_KEY/);
  });

  it("handleCallback rejects a missing state (PKCE cannot be derived)", async () => {
    await expect(
      tt.handleCallback({ code: "c", redirectUri: "https://app/cb" }),
    ).rejects.toThrow(/state/);
  });

  it("validate rejects an over-limit caption (max 2200)", () => {
    const res = tt.validate({
      type: "video",
      caption: "x".repeat(2201),
      media: [{ kind: "video", url: "u", order: 0 }],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/2200/);
  });

  it("validate rejects video posts with no media", () => {
    expect(tt.validate({ type: "video", caption: "hi", media: [] }).ok).toBe(false);
  });

  it("validate rejects text posts (unsupported on TikTok)", () => {
    expect(tt.validate({ type: "text", caption: "hi", media: [] }).ok).toBe(false);
  });

  it("validate accepts a well-formed video post", () => {
    expect(
      tt.validate({ type: "video", caption: "clip", media: [{ kind: "video", url: "u", order: 0 }] }).ok,
    ).toBe(true);
  });
});

describe("YoutubeProvider (live)", () => {
  const yt = new YoutubeProvider();

  it("getAuthUrl points at Google OAuth with offline access and youtube.upload scope", () => {
    process.env.YOUTUBE_CLIENT_ID = "yt-test-id";
    const url = new URL(yt.getAuthUrl({ state: "csrf123", redirectUri: "https://app/cb" }));
    expect(url.hostname).toContain("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("yt-test-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
    expect(url.searchParams.get("state")).toBe("csrf123");
    expect(url.searchParams.get("response_type")).toBe("code");
    // Force a refresh token to be returned.
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    // Google uses space-separated scopes.
    expect(url.searchParams.get("scope")).toMatch(/youtube\.upload/);
    expect(url.searchParams.get("scope")).toContain(" ");
  });

  it("getAuthUrl throws when neither YOUTUBE_CLIENT_ID nor GOOGLE_CLIENT_ID is set", () => {
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => yt.getAuthUrl({ state: "s", redirectUri: "r" })).toThrow(/YOUTUBE_CLIENT_ID/);
  });

  it("getAuthUrl falls back to GOOGLE_CLIENT_ID when YOUTUBE_CLIENT_ID is unset", () => {
    delete process.env.YOUTUBE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = "google-test-id";
    const url = new URL(yt.getAuthUrl({ state: "s", redirectUri: "https://app/cb" }));
    expect(url.searchParams.get("client_id")).toBe("google-test-id");
  });

  it("refresh throws without a stored refresh token", async () => {
    await expect(yt.refresh({ accessToken: "t", scopes: [] })).rejects.toThrow(/refresh token/);
  });

  it("validate rejects an over-limit caption (max 5000)", () => {
    const res = yt.validate({
      type: "video",
      caption: "x".repeat(5001),
      media: [{ kind: "video", url: "u", order: 0 }],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/5000/);
  });

  it("validate rejects video posts with no media", () => {
    expect(yt.validate({ type: "video", caption: "hi", media: [] }).ok).toBe(false);
  });

  it("validate rejects more than one media item (max 1)", () => {
    const res = yt.validate({
      type: "video",
      caption: "clip",
      media: [
        { kind: "video", url: "a", order: 0 },
        { kind: "video", url: "b", order: 1 },
      ],
    });
    expect(res.ok).toBe(false);
  });

  it("validate rejects non-video media", () => {
    const res = yt.validate({
      type: "video",
      caption: "clip",
      media: [{ kind: "image", url: "u", order: 0 }],
    });
    expect(res.ok).toBe(false);
  });

  it("validate rejects unsupported types (text/image/story)", () => {
    expect(yt.validate({ type: "text", caption: "hi", media: [] }).ok).toBe(false);
    expect(yt.validate({ type: "image", caption: "hi", media: [{ kind: "image", url: "u", order: 0 }] }).ok).toBe(
      false,
    );
  });

  it("validate accepts a well-formed video post", () => {
    expect(
      yt.validate({ type: "video", caption: "clip", media: [{ kind: "video", url: "u", order: 0 }] }).ok,
    ).toBe(true);
  });
});

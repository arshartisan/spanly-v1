import { describe, expect, it } from "vitest";
import { getProvider } from "@/providers/registry";

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
    const r = await getProvider("linkedin").publish(
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

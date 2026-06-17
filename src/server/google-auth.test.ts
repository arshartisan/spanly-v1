import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// google-auth.ts imports "server-only" (a Next build alias). Stub it. We stub the global fetch
// to drive the token + userinfo round-trips without real network access.
vi.mock("server-only", () => ({}));

import { googleAuthUrl, exchangeGoogleCode } from "./google-auth";

beforeEach(() => {
  process.env.GOOGLE_AUTH_CLIENT_ID = "cid";
  process.env.GOOGLE_AUTH_CLIENT_SECRET = "secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ok = (body: unknown) => ({
  ok: true,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/** Queue one fetch response per call, in order, and install the stub. */
function mockFetchSequence(responses: unknown[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("googleAuthUrl", () => {
  it("builds the consent URL with the required params", () => {
    const url = new URL(googleAuthUrl({ state: "st", redirectUri: "https://app.test/cb" }));
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("throws a clear error when the client id is missing", () => {
    delete process.env.GOOGLE_AUTH_CLIENT_ID;
    expect(() => googleAuthUrl({ state: "s", redirectUri: "r" })).toThrow(/GOOGLE_AUTH_CLIENT_ID/);
  });
});

describe("exchangeGoogleCode", () => {
  it("exchanges the code, then normalizes the profile (lowercased email)", async () => {
    const fetchMock = mockFetchSequence([
      ok({ access_token: "at" }),
      ok({ sub: "123", email: "USER@Example.com", email_verified: true, name: "Jo", picture: "p" }),
    ]);

    const profile = await exchangeGoogleCode({ code: "c", redirectUri: "https://app.test/cb" });

    expect(profile).toEqual({
      sub: "123",
      email: "user@example.com",
      emailVerified: true,
      name: "Jo",
      picture: "p",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("oauth2.googleapis.com/token");
    expect(String(fetchMock.mock.calls[1][0])).toContain("openidconnect.googleapis.com/v1/userinfo");
  });

  it("treats a stringified email_verified as verified and defaults name/picture to null", async () => {
    mockFetchSequence([
      ok({ access_token: "at" }),
      ok({ sub: "1", email: "a@b.com", email_verified: "true" }),
    ]);
    const profile = await exchangeGoogleCode({ code: "c", redirectUri: "r" });
    expect(profile.emailVerified).toBe(true);
    expect(profile.name).toBeNull();
    expect(profile.picture).toBeNull();
  });

  it("reports an unverified email as emailVerified:false", async () => {
    mockFetchSequence([
      ok({ access_token: "at" }),
      ok({ sub: "1", email: "a@b.com", email_verified: false }),
    ]);
    expect((await exchangeGoogleCode({ code: "c", redirectUri: "r" })).emailVerified).toBe(false);
  });

  it("throws when the token exchange fails", async () => {
    mockFetchSequence([{ ok: false, status: 400, text: async () => "bad_request" }]);
    await expect(exchangeGoogleCode({ code: "c", redirectUri: "r" })).rejects.toThrow(
      /token exchange failed/,
    );
  });

  it("throws when the access_token is missing", async () => {
    mockFetchSequence([ok({})]);
    await expect(exchangeGoogleCode({ code: "c", redirectUri: "r" })).rejects.toThrow(
      /missing access_token/,
    );
  });

  it("throws when the profile is missing sub/email", async () => {
    mockFetchSequence([ok({ access_token: "at" }), ok({ sub: "1" })]);
    await expect(exchangeGoogleCode({ code: "c", redirectUri: "r" })).rejects.toThrow(
      /missing sub\/email/,
    );
  });
});

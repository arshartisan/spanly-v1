import { describe, expect, it } from "vitest";
import { humanizePublishError } from "./publish-error";

describe("humanizePublishError", () => {
  it("maps Facebook 'cannot call API on behalf of user' (code 200) to a permission error", () => {
    const raw =
      'Facebook feed publish failed (400): {"error":{"message":"Cannot call API for app 1031369106048713 on behalf of user 122111013093352609","type":"OAuthException","code":200,"fbtrace_id":"AQG_qu4FW_Ik8kkhzfnVUDT"}}';
    const r = humanizePublishError(raw);
    expect(r.kind).toBe("permission");
    expect(r.message).not.toContain("{"); // no raw JSON leaking into the headline
    expect(r.hint).toBeTruthy();
    expect(r.raw).toBe(raw); // raw preserved for the details disclosure
  });

  it("maps an expired token (code 190) to an auth error", () => {
    const raw =
      'Facebook publish failed (400): {"error":{"message":"Error validating access token: Session has expired","type":"OAuthException","code":190}}';
    expect(humanizePublishError(raw).kind).toBe("auth");
  });

  it("maps rate-limit codes to a rate error", () => {
    const raw =
      'Facebook feed publish failed (400): {"error":{"message":"(#4) Application request limit reached","type":"OAuthException","code":4}}';
    expect(humanizePublishError(raw).kind).toBe("rate");
  });

  it("detects auth wording in plain (non-Graph) error strings", () => {
    expect(humanizePublishError("Token expired — please reconnect.").kind).toBe("auth");
  });

  it("falls back to a generic message and never throws on junk", () => {
    expect(humanizePublishError("boom").kind).toBe("generic");
    expect(humanizePublishError("").message).toBe("Publishing failed.");
    expect(humanizePublishError(null).kind).toBe("generic");
  });
});

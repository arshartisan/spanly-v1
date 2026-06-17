import crypto from "node:crypto";
import "server-only";

/**
 * Signed, expiring `state` for the Google SIGN-IN flow (login/signup), the auth-side
 * sibling of `oauth-state.ts` (which is for the logged-in platform-connect flow). The user
 * is NOT authenticated yet when this is signed, so the payload carries no userId - only the
 * post-login `next` redirect plus a nonce/expiry for CSRF. Format:
 * base64url(payload).hmacSha256(payload), keyed by NEXTAUTH_SECRET.
 */
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface AuthOAuthState {
  next?: string; // app-relative path to return to after sign-in
  nonce: string;
  exp: number; // epoch ms
}

function secret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is required to sign OAuth state.");
  return Buffer.from(s, "utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signAuthState(input: { next?: string }): string {
  const state: AuthOAuthState = {
    next: input.next,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the decoded state, or null if malformed, tampered, or expired. */
export function verifyAuthState(token: string | null | undefined): AuthOAuthState | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthOAuthState;
    if (typeof state.exp !== "number" || state.exp < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

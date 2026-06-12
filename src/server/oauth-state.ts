import crypto from "node:crypto";
import "server-only";
import type { PlatformKey } from "@/lib/platforms";

/**
 * Signed, expiring OAuth `state` for CSRF protection on the connect flow
 * (docs/implementation/05 + 14). The state round-trips through the provider and is
 * verified in the callback. Format: base64url(payload).hmacSha256(payload).
 *
 * HMAC keyed by NEXTAUTH_SECRET (already required by the app). State is opaque to the
 * provider and carries no secrets — only who started the flow and for which platform.
 */
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthState {
  userId: string;
  platform: PlatformKey;
  method?: "instagram" | "facebook"; // Instagram connect-method choice
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

export function signState(input: Omit<OAuthState, "nonce" | "exp">): string {
  const state: OAuthState = {
    ...input,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the decoded state, or null if malformed, tampered, or expired. */
export function verifyState(token: string | null | undefined): OAuthState | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (typeof state.exp !== "number" || state.exp < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

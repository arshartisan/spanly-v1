import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/server/billing-config";

/**
 * Stateless one-click unsubscribe tokens for newsletters (CAN-SPAM / RFC 8058). The token is an
 * HMAC of the userId keyed by NEXTAUTH_SECRET, so links never expire and need no DB row - a user
 * can unsubscribe from any old email at any time. The token only grants "turn marketing off for
 * this user", never read access, so a long-lived token is safe here.
 */

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is required to sign unsubscribe links.");
  return s;
}

export function signUnsubscribe(userId: string): string {
  return createHmac("sha256", secret()).update(`unsub:${userId}`).digest("hex");
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  const expected = signUnsubscribe(userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute unsubscribe URL for a given user, embedded in newsletter emails + List-Unsubscribe. */
export function unsubscribeUrl(userId: string): string {
  const qs = new URLSearchParams({ u: userId, t: signUnsubscribe(userId) });
  return appUrl(`/api/email/unsubscribe?${qs.toString()}`);
}

import "server-only";
import { randomBytes, randomInt, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";

/**
 * New-device login step-up (D-013). After a correct password, a login from an UNRECOGNIZED device
 * must clear a 6-digit code emailed to the user; recognized devices skip it. "Recognized" =
 * the browser presents a `spanly_device` cookie whose hash matches a non-expired TrustedDevice
 * row for that user. Google OAuth logins are already identity-verified and bypass this entirely.
 */

export const DEVICE_COOKIE = "spanly_device";
export const OTP_TTL_MINUTES = 10;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const DEVICE_TRUST_DAYS = 30;

/** What an OTP is for. Scopes issue/verify so codes can't cross between flows. */
export type OtpPurpose = "login" | "verify_email";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ─────────────────────────── Device trust ───────────────────────────

/** True if the current request's device cookie maps to a live TrustedDevice for this user. */
export async function isTrustedDevice(userId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(DEVICE_COOKIE)?.value;
  if (!token) return false;

  const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: sha256(token) } });
  if (!device || device.userId !== userId || device.expiresAt.getTime() < Date.now()) return false;

  // Bump lastUsedAt (best-effort); ignore races.
  await prisma.trustedDevice
    .update({ where: { id: device.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return true;
}

/** Remember the current device for 30 days so future logins skip OTP. Sets the device cookie. */
export async function trustCurrentDevice(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000);
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// ─────────────────────────── OTP codes ───────────────────────────

/**
 * Issue a fresh 6-digit code for the user + purpose. Invalidates any prior un-consumed codes of the
 * SAME purpose so only the latest works, then returns the raw code for emailing (only the hash is
 * stored). Purpose defaults to "login" so existing callers are unchanged.
 */
export async function issueLoginOtp(userId: string, purpose: OtpPurpose = "login"): Promise<string> {
  // Cryptographically-uniform 6-digit code (000000-999999), zero-padded.
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  // One active code at a time per purpose: mark previous unconsumed codes consumed.
  await prisma.loginOtp.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.loginOtp.create({
    data: { userId, purpose, codeHash: sha256(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  return code;
}

export type OtpResult = "ok" | "invalid" | "expired" | "too_many_attempts";

/**
 * Verify a submitted code against the user's latest active OTP for the given purpose. Consumes it
 * on success; counts a failed attempt and locks the code after MAX_OTP_ATTEMPTS. Returns a
 * discriminated result so the route can map to the right message without leaking which codes exist.
 */
export async function verifyLoginOtp(
  userId: string,
  code: string,
  purpose: OtpPurpose = "login",
): Promise<OtpResult> {
  const row = await prisma.loginOtp.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return "invalid";
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  if (row.attempts >= MAX_OTP_ATTEMPTS) return "too_many_attempts";

  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(sha256(code));
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    const updated = await prisma.loginOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts >= MAX_OTP_ATTEMPTS ? "too_many_attempts" : "invalid";
  }

  await prisma.loginOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return "ok";
}

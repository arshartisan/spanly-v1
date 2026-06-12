import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Subscription, User } from "@prisma/client";
import { prisma } from "@/server/db";

// Lightweight custom DB-session auth (D-012). The session cookie holds only a
// high-entropy opaque token; all validation is a DB lookup against `Session`.
// Deleting Session rows = "sign out of all devices".

export const SESSION_COOKIE = "spanly_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_COST = 12;

// Dummy hash compared against when a user isn't found, to keep login timing
// constant and avoid user enumeration (doc 03 edge cases).
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3f1pX1xGq8m1q8m1q8m1q8m1q8m1q8m";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Constant-time-ish dummy verify for the user-not-found branch. */
export async function dummyVerify(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}

function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Create a Session row for the user and set the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const sessionToken = newSessionToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

/** Destroy the current session (this device only). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }
  store.delete(SESSION_COOKIE);
}

/** Delete every session for a user (doc 03 "sign out of all devices"). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = User & { subscription: Subscription | null };

/**
 * Resolve the signed-in user from the session cookie, or null. Expired sessions
 * are treated as logged-out (and swept). Safe to call in any Server Component.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: { include: { subscription: true } } },
  });
  if (!session) return null;
  if (session.expires.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

// ─────────────────────────── Verification tokens ───────────────────────────
// Single-use tokens for email verification + password reset (doc 03). We store a
// SHA-256 of the token so a DB leak can't be replayed; the raw token goes in the link.

export type TokenType = "verify_email" | "reset_password";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function issueToken(
  userId: string,
  type: TokenType,
  ttlMs: number,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: { userId, type, token: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return raw;
}

/**
 * Validate + consume a token. Returns the userId on success, or null if the token
 * is unknown, of the wrong type, expired, or already used.
 */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  const hashed = sha256(raw);
  const row = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  // Constant-time compare as defence-in-depth (lookup already used the hash).
  const a = Buffer.from(row.token);
  const b = Buffer.from(hashed);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await prisma.verificationToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row.userId;
}

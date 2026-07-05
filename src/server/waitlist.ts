import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";

/**
 * Waitlist store (doc 20 waitlist mode). Backs the public landing page while the site is in
 * waitlist mode: collects normalized emails and exposes a total count for the social-proof
 * counter. Enrolment is idempotent - re-submitting an existing email returns its existing
 * position rather than erroring, so the UI never leaks anything beyond the submitter's own row.
 *
 * The count is served from a short-TTL in-process cache (mirrors settings/flags.ts) so the
 * public counter is cheap under bursty traffic; any new enrolment clears it.
 */

// Reuse the same email validation as the auth schemas (doc 03). Normalization (lowercase +
// trim) happens in addToWaitlist before this runs.
const waitlistEmailSchema = z.string().email();

// ─────────────────────────── Count cache ───────────────────────────

const COUNT_CACHE_TTL_MS = 20_000; // 20s - matches the flags cache; the counter is cosmetic.

interface CachedCount {
  count: number;
  exp: number;
}

let countCache: CachedCount | null = null;

// ─────────────────────────── Writes ───────────────────────────

export interface AddToWaitlistResult {
  /** 1-indexed position by createdAt ordering (count of entries on/before this one). */
  position: number;
  /** True when the email was already on the list (idempotent re-submit). */
  alreadyJoined: boolean;
}

/**
 * Enrol an email on the waitlist. Normalizes to lowercase + trim, then upserts: if the email
 * already exists we return its current position with `alreadyJoined: true`; otherwise we create
 * a new row. Throws a ZodError if the email is invalid (callers validate at the API boundary
 * first, so this is a defensive second check).
 */
export async function addToWaitlist(
  email: string,
  opts?: { ip?: string; source?: string },
): Promise<AddToWaitlistResult> {
  const normalizedEmail = waitlistEmailSchema.parse(email.trim().toLowerCase());

  const existing = await prisma.waitlistEntry.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { position: await positionOf(existing.createdAt), alreadyJoined: true };
  }

  const created = await prisma.waitlistEntry.create({
    data: {
      email: normalizedEmail,
      ip: opts?.ip ?? null,
      source: opts?.source ?? null,
    },
  });
  countCache = null; // new enrolment invalidates the cached total.
  return { position: await positionOf(created.createdAt), alreadyJoined: false };
}

/** Count of entries created on/before `createdAt` - the 1-indexed waitlist position. */
async function positionOf(createdAt: Date): Promise<number> {
  return prisma.waitlistEntry.count({ where: { createdAt: { lte: createdAt } } });
}

// ─────────────────────────── Reads ───────────────────────────

/**
 * Total number of waitlist entries, served from the short-TTL cache. Used by the public social
 * -proof counter (GET /api/waitlist) and the marketing page.
 */
export async function waitlistCount(): Promise<number> {
  const now = Date.now();
  if (countCache && countCache.exp > now) return countCache.count;

  const count = await prisma.waitlistEntry.count();
  countCache = { count, exp: now + COUNT_CACHE_TTL_MS };
  return count;
}

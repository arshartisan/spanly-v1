import "server-only";
import type { Announcement, FeatureFlag, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { PLATFORMS } from "@/lib/platforms";

/**
 * Platform settings & feature-flag store (doc 20). A DB-backed kill-switch / config
 * layer read by both the admin UI and the customer app's gates.
 *
 * THE #1 RULE: a MISSING / unknown flag row defaults to ENABLED — an absent flag must
 * NEVER block the product (no row should ever break signup or publishing). The single
 * exception is `maintenance-mode`, which defaults to OFF (absent = not in maintenance);
 * see DEFAULT_OFF below.
 *
 * Reads are served from a short-TTL in-process cache so the gates are cheap; any write
 * clears the cache so a kill switch takes effect within the TTL.
 */

// ─────────────────────────── Known flags ───────────────────────────

export interface KnownFlag {
  key: string;
  description: string;
}

/**
 * The seed set + the admin UI's list source. The UI merges stored rows with this list so
 * an unseeded key still shows as default-enabled. `platform.<p>` exists per platform.
 */
export const KNOWN_FLAGS: readonly KnownFlag[] = [
  { key: "signups", description: "Allow new account sign-ups." },
  { key: "publishing", description: "Allow posts to be dispatched to providers." },
  { key: "content-studio", description: "Enable the AI content studio." },
  { key: "bulk", description: "Enable bulk scheduling / CSV import." },
  { key: "api", description: "Enable the public v1 API + MCP surface." },
  {
    key: "maintenance-mode",
    description: "Put the customer app into maintenance mode (default off).",
  },
  ...PLATFORMS.map((p) => ({
    key: `platform.${p}`,
    description: `Allow connecting & publishing to ${p}.`,
  })),
];

/**
 * Flags whose ABSENT default is `false`. Only `maintenance-mode`: a missing row means the
 * app is NOT in maintenance. Every other flag defaults to true when its row is missing.
 */
const DEFAULT_OFF = new Set<string>(["maintenance-mode"]);

/** The default `enabled` value for a flag with no stored row. */
function defaultEnabled(key: string): boolean {
  return !DEFAULT_OFF.has(key);
}

// ─────────────────────────── In-process cache ───────────────────────────

const CACHE_TTL_MS = 20_000; // 20s — long enough to cheapen the gates, short enough that a kill switch lands fast.

interface CachedFlag {
  enabled: boolean;
  value: Prisma.JsonValue | null;
  exp: number;
}

const cache = new Map<string, CachedFlag>();

/** Drop a single key (or the whole table) from the cache. Called on every write. */
function invalidate(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

// ─────────────────────────── Reads ───────────────────────────

/**
 * Whether a flag is enabled. Served from the cache; a missing/unknown row defaults to
 * `true` (except `maintenance-mode` → false). This default rule is the kill-switch
 * safety net — never let an absent row break the product.
 */
export async function isEnabled(key: string): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.enabled;

  const row = await prisma.featureFlag.findUnique({ where: { key } });
  const enabled = row ? row.enabled : defaultEnabled(key);
  cache.set(key, { enabled, value: row?.value ?? null, exp: now + CACHE_TTL_MS });
  return enabled;
}

/** The stored row for a flag, or null if it has never been written. */
export async function getFlag(key: string): Promise<FeatureFlag | null> {
  return prisma.featureFlag.findUnique({ where: { key } });
}

/**
 * Every stored flag row. The admin GET returns these; the UI merges them with KNOWN_FLAGS
 * so unseeded keys still surface as default-enabled.
 */
export async function listFlags(): Promise<FeatureFlag[]> {
  return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
}

// ─────────────────────────── Writes ───────────────────────────

/**
 * Upsert a flag and clear it from the cache so the change lands within the TTL. Returns the
 * stored row. The route captures before/after for the audit trail.
 */
export async function setFlag(
  key: string,
  enabled: boolean,
  value: Prisma.InputJsonValue | undefined,
  actorId: string,
): Promise<FeatureFlag> {
  const description = KNOWN_FLAGS.find((f) => f.key === key)?.description;
  const row = await prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled, value, description, updatedById: actorId },
    update: { enabled, value, updatedById: actorId },
  });
  invalidate(key);
  return row;
}

// ─────────────────────────── Announcements ───────────────────────────

/** The shape of the user `activeAnnouncements` needs (subscription plan + status). */
export interface AudienceUser {
  subscription: { plan: string; status: string } | null;
}

/**
 * Pure audience matcher (exported for tests). `all` matches everyone; `trialing` matches a
 * user whose subscription is trialing; `plan:<key>` matches a user on that plan. An unknown
 * audience string matches no one (fail closed for targeting, not for the kill switch).
 */
export function matchesAudience(audience: string, user: AudienceUser): boolean {
  if (audience === "all") return true;
  if (audience === "trialing") return user.subscription?.status === "trialing";
  if (audience.startsWith("plan:")) {
    return user.subscription?.plan === audience.slice("plan:".length);
  }
  return false;
}

/**
 * Active announcements for a user: `active`, within the [startsAt, endsAt] window (null =
 * open-ended on that side), and matching the user's audience. Newest first.
 */
export async function activeAnnouncements(user: AudienceUser): Promise<Announcement[]> {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((a) => matchesAudience(a.audience, user));
}

/** All announcements, newest first (admin list — no window/audience filtering). */
export async function listAnnouncements(): Promise<Announcement[]> {
  return prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
}

export interface AnnouncementCreateInput {
  message: string;
  severity: string;
  audience: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  active?: boolean;
}

export async function createAnnouncement(
  input: AnnouncementCreateInput,
  actorId: string,
): Promise<Announcement> {
  return prisma.announcement.create({
    data: {
      message: input.message,
      severity: input.severity,
      audience: input.audience,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      active: input.active ?? true,
      createdById: actorId,
    },
  });
}

export interface AnnouncementUpdateInput {
  message?: string;
  severity?: string;
  audience?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  active?: boolean;
}

/** Patch an announcement (only the provided fields). Returns null if it does not exist. */
export async function updateAnnouncement(
  id: string,
  patch: AnnouncementUpdateInput,
): Promise<Announcement | null> {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.announcement.update({ where: { id }, data: patch });
}

/** Delete an announcement. Returns false if it did not exist. */
export async function deleteAnnouncement(id: string): Promise<boolean> {
  const res = await prisma.announcement.deleteMany({ where: { id } });
  return res.count > 0;
}

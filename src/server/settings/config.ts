import "server-only";
import { prisma } from "@/server/db";

/**
 * Platform config defaults store (doc 20 sibling of flags.ts). DB-backed, admin-editable
 * scalars that used to be hardcoded consts: trial length, refund window, signups default.
 * Read from the PlatformConfig table with the same short-TTL in-process cache + fallback
 * pattern as flags.ts. Reads NEVER throw — a missing row or an unreachable DB falls back to
 * the documented default so signup / billing keep working.
 */

const CACHE_TTL_MS = 20_000;

interface CachedConfig {
  value: unknown;
  exp: number;
}

const cache = new Map<string, CachedConfig>();

/** Drop a single key (or the whole store) from the cache. Call on every write. */
export function invalidateConfigCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Coerce a stored JSON config value to an integer, falling back when absent / unparseable.
 * Accepts a number or a numeric string. Pure (exported for tests).
 */
export function parseIntConfig(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Coerce a stored JSON config value to a boolean, falling back when absent. Pure. */
export function parseBoolConfig(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

/** Read a raw config value (cached). Returns null on absent row or DB error — never throws. */
async function readConfig(key: string): Promise<unknown> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.value;

  let value: unknown = null;
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key } });
    value = row?.value ?? null;
  } catch {
    value = null; // DB unreachable — fall through to the caller's fallback.
  }
  cache.set(key, { value, exp: now + CACHE_TTL_MS });
  return value;
}

/** Free-trial length in days. Default 7. */
export async function getTrialDays(): Promise<number> {
  return parseIntConfig(await readConfig("trialDays"), 7);
}

/** Money-back refund window in days. Default 7. */
export async function getRefundWindowDays(): Promise<number> {
  return parseIntConfig(await readConfig("refundWindowDays"), 7);
}

/** Whether new sign-ups are allowed by default. Default true. */
export async function getSignupsDefault(): Promise<boolean> {
  return parseBoolConfig(await readConfig("signupsDefault"), true);
}

// ─────────────────────────── Editable defaults (admin CRUD) ───────────────────────────

/** The editable platform default scalars, as the admin surface reads/writes them. */
export interface EditableDefaults {
  trialDays: number;
  refundWindowDays: number;
  signupsDefault: boolean;
}

/** A partial patch of the editable defaults — only the provided keys are written. */
export interface EditableDefaultsPatch {
  trialDays?: number;
  refundWindowDays?: number;
  signupsDefault?: boolean;
}

/**
 * The three editable defaults, using the SAME fallbacks as the getters above. Reads never
 * throw (a missing row / unreachable DB falls back to the documented default).
 */
export async function getEditableDefaults(): Promise<EditableDefaults> {
  const [trialDays, refundWindowDays, signupsDefault] = await Promise.all([
    getTrialDays(),
    getRefundWindowDays(),
    getSignupsDefault(),
  ]);
  return { trialDays, refundWindowDays, signupsDefault };
}

/**
 * Upsert ONLY the provided default keys into PlatformConfig, then invalidate the cache so the
 * change lands within the TTL (the signup route + billing read these via the getters above, so
 * editing them takes effect live). Returns the full effective defaults after the write. Range
 * validation lives in the Zod layer (`defaultsUpdateSchema`).
 */
export async function setEditableDefaults(
  patch: EditableDefaultsPatch,
): Promise<EditableDefaults> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [
    keyof EditableDefaults,
    number | boolean,
  ][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.platformConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  for (const [key] of entries) invalidateConfigCache(key);
  return getEditableDefaults();
}

/**
 * Cookie-consent model — the single source of truth for what categories exist, how the
 * choice is persisted, and when we must re-ask. Deliberately isomorphic (no "server-only"):
 * the pure parse/serialize helpers run on both the server and the client, while the
 * `document.cookie` helpers guard for SSR so this file is safe to import anywhere.
 *
 * Compliance shape (UK PECR / EU GDPR / US state laws):
 *  - "necessary" cookies are always on and need no consent (session auth, security).
 *  - every other category is OPT-IN and off by default — nothing non-essential loads
 *    until the user actively grants it, and rejecting must be as easy as accepting.
 *  - the choice is stored with a schema version + timestamp so we can re-ask when the
 *    cookie list changes or the consent goes stale.
 */

export const CONSENT_COOKIE = "spanly_consent";

/**
 * Bump when the set of cookies/categories materially changes. An older version in a
 * stored record is treated as "no decision yet", so users are re-prompted.
 */
export const CONSENT_VERSION = 1;

/** Re-ask after this long (ICO/EDPB guidance: refresh roughly every 6–12 months). */
export const CONSENT_MAX_AGE_DAYS = 180;

/** Categories the user can toggle. "necessary" is implicit and never optional. */
export const OPTIONAL_CATEGORIES = ["analytics"] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export type ConsentCategory = "necessary" | OptionalCategory;

export interface ConsentState {
  /** Strictly necessary cookies — always granted. */
  necessary: true;
  /** Anonymous product analytics to understand and improve the Service. */
  analytics: boolean;
}

export interface ConsentRecord {
  /** Schema version this record was written against. */
  v: number;
  categories: ConsentState;
  /** ISO timestamp of the last explicit choice (audit trail + staleness checks). */
  updatedAt: string;
}

export const NECESSARY_ONLY: ConsentState = { necessary: true, analytics: false };
export const ALL_GRANTED: ConsentState = { necessary: true, analytics: true };

/** Normalize any boolean-ish category map into a well-formed ConsentState. */
function normalize(categories: { analytics?: unknown }): ConsentState {
  return { necessary: true, analytics: categories.analytics === true };
}

/**
 * Parse a raw cookie value into a record, or null when there is no valid, current
 * decision (missing, malformed, or from a superseded schema version → re-ask).
 */
export function parseConsentCookie(raw: string | undefined | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof (decoded as ConsentRecord).v !== "number" ||
      typeof (decoded as ConsentRecord).categories !== "object"
    ) {
      return null;
    }
    const record = decoded as ConsentRecord;
    // A record from an older schema is "no decision" so the banner shows again.
    if (record.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      categories: normalize(record.categories),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    };
  } catch {
    return null;
  }
}

/** Serialize a choice into the URL-encoded value stored in the cookie. */
export function serializeConsentCookie(state: ConsentState, now: string): string {
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    categories: normalize(state),
    updatedAt: now,
  };
  return encodeURIComponent(JSON.stringify(record));
}

// ─────────────────────────── client-only cookie I/O ───────────────────────────
// Guarded so importing this module on the server is harmless.

/** Read and parse the consent cookie in the browser. Returns null on the server. */
export function readConsentCookie(): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CONSENT_COOKIE}=`;
  const match = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return parseConsentCookie(match ? match.slice(prefix.length) : null);
}

/**
 * Persist a choice to a first-party cookie (readable by the server so SSR can gate
 * scripts later) and broadcast it so any mounted listeners react immediately.
 */
export function writeConsentCookie(state: ConsentState): void {
  if (typeof document === "undefined") return;
  const value = serializeConsentCookie(state, new Date().toISOString());
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

// Derives a UI-friendly token-health state for a connected social account.
// Used by the connections page (docs/implementation/05): the worker's token-refresh sweep
// (src/server/maintenance.ts) warns 24h ahead; here we warn the user 7 days ahead so they
// can reconnect before publishing ever races an expiry.

export type ExpiryLevel = "active" | "expiring" | "expired";

export interface ExpiryInfo {
  /** active = healthy, expiring = within the warning window, expired = dead/needs re-login. */
  level: ExpiryLevel;
  /** Short relative label, e.g. "Expires in 3 days" / "Expires today" / "Expired". */
  label: string;
  /** Absolute datetime for a tooltip, or null when no expiry is tracked. */
  exact: string | null;
}

/** Warn this far ahead of the actual expiry. */
export const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relative(deltaMs: number): string {
  const days = Math.round(deltaMs / (24 * 60 * 60 * 1000));
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  const hours = Math.round(deltaMs / (60 * 60 * 1000));
  if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
  const minutes = Math.round(deltaMs / (60 * 1000));
  return rtf.format(minutes, "minute");
}

/**
 * Compute the token-health state. The persisted `status` wins when it already reports a
 * problem (expired/error) — the provider/worker flipped it for a reason a date can't see
 * (e.g. revoked access). Otherwise we derive the level from how soon `tokenExpiresAt` lands.
 */
export function computeExpiry(
  tokenExpiresAt: string | Date | null,
  status: "active" | "expired" | "error",
  now: Date = new Date(),
): ExpiryInfo {
  if (status === "expired" || status === "error") {
    return { level: "expired", label: "Reconnect needed", exact: null };
  }

  if (!tokenExpiresAt) {
    // No tracked expiry (long-lived / non-expiring token) — treat as healthy, no label.
    return { level: "active", label: "Active", exact: null };
  }

  const expiry = tokenExpiresAt instanceof Date ? tokenExpiresAt : new Date(tokenExpiresAt);
  const delta = expiry.getTime() - now.getTime();
  const exact = expiry.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  if (delta <= 0) {
    return { level: "expired", label: "Expired", exact };
  }
  if (delta <= EXPIRING_WINDOW_MS) {
    return { level: "expiring", label: `Expires ${relative(delta)}`, exact };
  }
  return { level: "active", label: `Expires ${relative(delta)}`, exact };
}

import "server-only";

/**
 * "Add to queue" slot computation (docs/implementation/08). Given the user's QueueSettings
 * (timezone + weekly slots) we find the next future slot not already taken by another queued
 * post. publishAt is always stored in UTC; slots are wall-clock times in the user's tz.
 *
 * We avoid a tz dependency: Intl gives us the zone offset at any instant, which is enough to
 * map a local wall-clock time to the correct UTC instant (refined once for DST boundaries).
 */

export interface QueueSlotDef {
  time: string; // "HH:mm" 24h, user-local
  days: boolean[]; // length 7, Mon..Sun
}

export interface QueueSettingsDef {
  timezone: string;
  slots: QueueSlotDef[];
}

/** Wall-clock components of `date` as seen in `tz`. */
function localParts(date: Date, tz: string): { y: number; m0: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return { y: Number(map.year), m0: Number(map.month) - 1, d: Number(map.day) };
}

/** Offset (ms) between `tz` wall-clock and UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** The UTC instant whose wall-clock in `tz` equals the given local components. */
function zonedTimeToUtc(
  y: number,
  m0: number,
  d: number,
  hh: number,
  mm: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, m0, d, hh, mm);
  const offset = tzOffsetMs(new Date(guess), tz);
  let utc = guess - offset;
  const offset2 = tzOffsetMs(new Date(utc), tz);
  if (offset2 !== offset) utc = guess - offset2;
  return new Date(utc);
}

/**
 * Next open queue slot strictly after `now`, skipping any instant already taken by another
 * queued post. Returns null if no slot is configured in the lookahead window.
 */
export function nextQueueSlot(
  now: Date,
  settings: QueueSettingsDef,
  takenUtcMs: Set<number> = new Set(),
  lookaheadDays = 62,
): Date | null {
  const slots = [...settings.slots].sort((a, b) => a.time.localeCompare(b.time));
  if (slots.length === 0) return null;

  const { y, m0, d } = localParts(now, settings.timezone);

  for (let offset = 0; offset <= lookaheadDays; offset++) {
    const cal = new Date(Date.UTC(y, m0, d + offset));
    const cy = cal.getUTCFullYear();
    const cm0 = cal.getUTCMonth();
    const cd = cal.getUTCDate();
    const weekday = (cal.getUTCDay() + 6) % 7; // 0 = Mon … 6 = Sun

    for (const slot of slots) {
      if (!slot.days[weekday]) continue;
      const [hh, mm] = slot.time.split(":").map(Number);
      const candidate = zonedTimeToUtc(cy, cm0, cd, hh, mm, settings.timezone);
      if (candidate.getTime() <= now.getTime()) continue;
      if (takenUtcMs.has(candidate.getTime())) continue;
      return candidate;
    }
  }

  return null;
}

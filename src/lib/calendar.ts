// Calendar date math (docs/implementation/07). Grid cells are plain calendar dates (built on
// Date.UTC so getUTC* reads back the intended Y-M-D); posts are bucketed by their date in the
// user's timezone via localDateKey. Matching both as "YYYY-MM-DD" strings keeps DST correct.

export interface DayCell {
  date: Date;
  key: string; // YYYY-MM-DD
  dayNum: number;
  inMonth: boolean;
}

/** Calendar date (from UTC parts) as YYYY-MM-DD. */
export function ymd(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** The post's calendar day in the user's timezone, as YYYY-MM-DD. */
export function localDateKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Anchor date (UTC midnight of a calendar day) from a ?date=YYYY-MM-DD param, else today in tz. */
export function parseAnchor(dateParam: string | undefined, tz: string): Date {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return new Date(`${dateParam}T00:00:00Z`);
  }
  return new Date(`${localDateKey(new Date(), tz)}T00:00:00Z`);
}

export function addMonths(anchor: Date, delta: number): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + delta, 1));
}

export function addDays(anchor: Date, delta: number): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + delta));
}

/** 6×7 month grid starting on the Sunday on/before the 1st. */
export function monthCells(anchor: Date): DayCell[] {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const startDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(y, m, 1 - startDow + i));
    cells.push({ date: d, key: ymd(d), dayNum: d.getUTCDate(), inMonth: d.getUTCMonth() === m });
  }
  return cells;
}

/** The 7 days (Sun–Sat) of the week containing the anchor. */
export function weekCells(anchor: Date): DayCell[] {
  const dow = anchor.getUTCDay();
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - dow + i),
    );
    cells.push({ date: d, key: ymd(d), dayNum: d.getUTCDate(), inMonth: true });
  }
  return cells;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function monthLabel(anchor: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(anchor);
}

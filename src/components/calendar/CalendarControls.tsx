import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarPlatformFilter } from "./CalendarPlatformFilter";

/** Calendar header: month label, prev/next/today, month/week toggle, platform filter. URL-driven. */
export function CalendarControls({
  label,
  view,
  prevKey,
  nextKey,
  todayKey,
  anchorKey,
  platform,
}: {
  label: string;
  view: "month" | "week";
  prevKey: string;
  nextKey: string;
  todayKey: string;
  anchorKey: string;
  platform?: string;
}) {
  const q = (date: string, v: "month" | "week" = view, p = platform) => {
    const params = new URLSearchParams({ view: v, date });
    if (p) params.set("platform", p);
    return `/calendar?${params.toString()}`;
  };

  const navBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-muted";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link href={q(prevKey)} className={navBtn} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link href={q(nextKey)} className={navBtn} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href={q(todayKey)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          Today
        </Link>
        <h1 className="ml-1 text-xl font-semibold tracking-tight">{label}</h1>
      </div>

      <div className="flex items-center gap-2">
        <CalendarPlatformFilter view={view} anchorKey={anchorKey} platform={platform} />

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["month", "week"] as const).map((v) => (
            <Link
              key={v}
              href={q(anchorKey, v)}
              className={cn(
                "rounded-md px-3 py-1 font-medium capitalize transition-colors",
                view === v ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

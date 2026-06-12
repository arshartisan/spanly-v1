import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { STATUS_META, snippet } from "@/lib/post-display";
import {
  addDays,
  addMonths,
  localDateKey,
  monthCells,
  monthLabel,
  parseAnchor,
  weekCells,
  WEEKDAY_LABELS,
  ymd,
  type DayCell,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { CalendarControls } from "@/components/calendar/CalendarControls";

interface Chip {
  id: string;
  type: string;
  status: keyof typeof STATUS_META;
  time: string; // HH:mm local
  platforms: PlatformKey[];
  caption: string;
}

// /calendar (docs/implementation/07). Month/week views of scheduled + posted content, placed
// by publishAt/publishedAt in the user's timezone. One chip per post with stacked platform
// icons (density choice per doc). Drafts (no publishAt) don't appear.
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; platform?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const tz = user.timezone;

  const sp = await searchParams;
  const view: "month" | "week" = sp.view === "week" ? "week" : "month";
  const anchor = parseAnchor(sp.date, tz);
  const platform =
    sp.platform && PLATFORMS.includes(sp.platform as PlatformKey) ? (sp.platform as PlatformKey) : undefined;

  const cells = view === "month" ? monthCells(anchor) : weekCells(anchor);
  const windowStart = addDays(cells[0].date, -1);
  const windowEnd = addDays(cells[cells.length - 1].date, 2);

  const where: Prisma.PostWhereInput = {
    userId: user.id,
    OR: [
      { publishAt: { gte: windowStart, lte: windowEnd } },
      { publishedAt: { gte: windowStart, lte: windowEnd } },
    ],
  };
  if (platform) where.targets = { some: { account: { platform } } };

  const posts = await prisma.post.findMany({
    where,
    include: { targets: { include: { account: true } } },
  });

  // Bucket by local day.
  const byDay = new Map<string, Chip[]>();
  for (const post of posts) {
    const when = post.status === "posted" ? (post.publishedAt ?? post.publishAt) : post.publishAt;
    if (!when) continue;
    const key = localDateKey(when, tz);
    const chip: Chip = {
      id: post.id,
      type: post.type,
      status: post.status,
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(when),
      platforms: [...new Set(post.targets.map((t) => t.account.platform as PlatformKey))],
      caption: post.mainCaption,
    };
    const list = byDay.get(key) ?? [];
    list.push(chip);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const prevKey = ymd(view === "month" ? addMonths(anchor, -1) : addDays(anchor, -7));
  const nextKey = ymd(view === "month" ? addMonths(anchor, 1) : addDays(anchor, 7));
  const todayKey = localDateKey(new Date(), tz);
  const anchorKey = ymd(anchor);
  const label =
    view === "month"
      ? monthLabel(anchor)
      : `Week of ${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" }).format(cells[0].date)}`;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <CalendarControls
        label={label}
        view={view}
        prevKey={prevKey}
        nextKey={nextKey}
        todayKey={todayKey}
        anchorKey={anchorKey}
        platform={platform}
      />

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-background">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="border-b border-r px-2 py-1.5 text-center text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <DayBox
            key={cell.key}
            cell={cell}
            chips={byDay.get(cell.key) ?? []}
            isToday={cell.key === todayKey}
            tall={view === "week"}
          />
        ))}
      </div>
    </div>
  );
}

function DayBox({
  cell,
  chips,
  isToday,
  tall,
}: {
  cell: DayCell;
  chips: Chip[];
  isToday: boolean;
  tall: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 border-b border-r p-1.5 last:border-r-0",
        tall ? "min-h-[180px]" : "min-h-[104px]",
        !cell.inMonth && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-medium",
            isToday
              ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              : cell.inMonth
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {cell.dayNum}
        </span>
        <Link
          href={`/create/text?date=${cell.key}`}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Create post on this day"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {chips.map((chip) => (
          <Link
            key={chip.id}
            href={`/create/${chip.type}?postId=${chip.id}`}
            className="flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-1 text-[11px] hover:bg-muted"
            title={chip.caption}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_META[chip.status].dot)} />
            <span className="tabular-nums text-muted-foreground">{chip.time}</span>
            <span className="flex -space-x-1">
              {chip.platforms.map((p) => {
                const Icon = PLATFORM_STYLE[p].Icon;
                return (
                  <span
                    key={p}
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-white ring-1 ring-background"
                    style={{ backgroundColor: PLATFORM_STYLE[p].color }}
                  >
                    <Icon className="h-2 w-2" />
                  </span>
                );
              })}
            </span>
            <span className="truncate">{snippet(chip.caption, 24) || "—"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

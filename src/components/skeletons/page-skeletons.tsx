import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page-shaped loading skeletons that mirror the real layouts (same wrappers, grids and
 * card shapes) so route-level loading.tsx files render a faithful placeholder while the
 * server component fetches. Each top-level export matches one page and includes that
 * page's own `mx-auto max-w-7xl …` wrapper, since loading.tsx replaces the page body
 * inside the shared app/admin shell.
 */

const range = (n: number) => Array.from({ length: n });

/** Title + one-line description block used at the top of most pages. */
function HeaderSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-56" />
      {subtitle ? <Skeleton className="h-4 w-80 max-w-full" /> : null}
    </div>
  );
}

/** A four-up grid of stat/KPI cards (dashboard + admin overview). */
function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {range(count).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-4 p-5">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (/dashboard)
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <HeaderSkeleton />
      <StatGridSkeleton />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {range(4).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar (/calendar)
// ---------------------------------------------------------------------------
export function CalendarSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-background">
        {range(7).map((_, i) => (
          <div key={`h${i}`} className="border-b border-r px-2 py-1.5 last:border-r-0">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
        {range(35).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[104px] flex-col gap-1.5 border-b border-r p-1.5 last:border-r-0"
          >
            <Skeleton className="h-4 w-4" />
            {i % 3 === 0 ? <Skeleton className="h-5 w-full rounded-md" /> : null}
            {i % 4 === 0 ? <Skeleton className="h-5 w-2/3 rounded-md" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts list (/posts/[filter])
// ---------------------------------------------------------------------------
function PostCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {range(3).map((_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded-full ring-2 ring-background" />
          ))}
        </div>
        <Skeleton className="h-3.5 w-8" />
      </div>
    </div>
  );
}

export function PostListSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        {range(4).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {range(6).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connections (/connections)
// ---------------------------------------------------------------------------
function PlatformRowSkeleton() {
  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}

export function ConnectionsSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <HeaderSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {range(6).map((_, i) => (
          <PlatformRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings (/settings/[tab])
// ---------------------------------------------------------------------------
export function SettingsSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {range(4).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          {range(5).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-9 w-32 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer (/create/[type])
// ---------------------------------------------------------------------------
export function ComposerSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-5">
              {range(5).map((_, i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="flex gap-2">
                {range(3).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-9 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-28 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publishing (/publishing/[postId])
// ---------------------------------------------------------------------------
export function PublishingSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {range(3).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic table (admin list pages)
// ---------------------------------------------------------------------------
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-4 border-b border-border/60 px-4 py-3">
        {range(cols).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {range(rows).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-3 last:border-0"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {range(Math.max(0, cols - 2)).map((_, i) => (
            <Skeleton key={i} className="h-4 w-14" />
          ))}
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Admin overview (/admin) + generic admin list fallback
// ---------------------------------------------------------------------------
export function AdminPageSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <HeaderSkeleton />
      <StatGridSkeleton />
      <div className="flex flex-wrap gap-2">
        {range(3).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic content page (api-keys, bulk, help, and any uncovered app route)
// ---------------------------------------------------------------------------
const LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4", "w-5/6"];

export function GenericPageSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <HeaderSkeleton />
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {LINE_WIDTHS.map((w, i) => (
            <Skeleton key={i} className={`h-5 ${w}`} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {LINE_WIDTHS.slice(0, 4).map((w, i) => (
            <Skeleton key={i} className={`h-5 ${w}`} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

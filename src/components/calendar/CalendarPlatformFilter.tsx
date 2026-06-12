"use client";

import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";

/** Platform filter for the calendar — navigates with view+date preserved. */
export function CalendarPlatformFilter({
  view,
  anchorKey,
  platform,
}: {
  view: "month" | "week";
  anchorKey: string;
  platform?: string;
}) {
  const router = useRouter();
  return (
    <select
      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
      value={platform ?? "all"}
      onChange={(e) => {
        const params = new URLSearchParams({ view, date: anchorKey });
        if (e.target.value !== "all") params.set("platform", e.target.value);
        router.replace(`/calendar?${params.toString()}`);
      }}
    >
      <option value="all">All platforms</option>
      {PLATFORMS.map((p) => (
        <option key={p} value={p}>
          {PLATFORM_STYLE[p].label}
        </option>
      ))}
    </select>
  );
}

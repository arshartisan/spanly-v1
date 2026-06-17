"use client";

import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Platform filter for the calendar - navigates with view+date preserved. */
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
    <Select
      value={platform ?? "all"}
      onValueChange={(value) => {
        const params = new URLSearchParams({ view, date: anchorKey });
        if (value !== "all") params.set("platform", value);
        router.replace(`/calendar?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All platforms</SelectItem>
        {PLATFORMS.map((p) => (
          <SelectItem key={p} value={p}>
            {PLATFORM_STYLE[p].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

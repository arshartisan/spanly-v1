"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// URL-driven filter bar for the failed/active job list (doc 19), mirroring
// <ConnectionFilters/>. All state lives in the query string so the RSC page does the
// listJobs() call; this component only writes to the URL.

const QUEUES = [
  { value: "publish", label: "Publish" },
  { value: "media", label: "Media" },
  { value: "maintenance", label: "Maintenance" },
];

const STATES = [
  { value: "failed", label: "Failed" },
  { value: "active", label: "Active" },
  { value: "delayed", label: "Delayed" },
  { value: "waiting", label: "Waiting" },
];

export function JobsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <FilterSelect
        label="Queue"
        value={params.get("queue") ?? "publish"}
        onChange={(v) => setFilter("queue", v)}
        options={QUEUES}
        className="w-[170px]"
      />
      <FilterSelect
        label="State"
        value={params.get("state") ?? "failed"}
        onChange={(v) => setFilter("state", v)}
        options={STATES}
        className="w-[150px]"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

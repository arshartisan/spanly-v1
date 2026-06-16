"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Platform, PostStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_META } from "@/lib/post-display";
import { PLATFORM_STYLE } from "@/lib/platform-style";

// URL-driven filter bar for the admin content list (doc 18), mirroring <UserFilters/>.
// All state lives in the query string so the RSC page does the query; this component only
// writes to the URL. Search is debounced; every change resets the cursor so pagination
// restarts cleanly.

const ALL = "all";

const STATUSES = Object.values(PostStatus);
const PLATFORMS = Object.values(Platform);

export function ContentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("query") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the local search box in sync when the URL changes externally (e.g. Clear).
  useEffect(() => {
    setSearch(params.get("query") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("query")]);

  const writeParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("cursor"); // any filter change restarts pagination
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  function setFilter(key: string, value: string) {
    writeParams((next) => {
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
    });
  }

  function setDate(key: "from" | "to", value: string) {
    writeParams((next) => {
      if (!value) {
        next.delete(key);
        return;
      }
      // <input type="date"> yields YYYY-MM-DD; the schema expects an ISO datetime.
      const iso = new Date(`${value}T00:00:00.000Z`).toISOString();
      next.set(key, iso);
    });
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      writeParams((next) => {
        const trimmed = value.trim();
        if (trimmed) next.set("query", trimmed);
        else next.delete("query");
      });
    }, 350);
  }

  // Reflect the stored ISO datetime back into the date input's YYYY-MM-DD value.
  function dateValue(key: "from" | "to"): string {
    const raw = params.get(key);
    if (!raw) return "";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }

  const hasFilters =
    Boolean(params.get("query")) ||
    Boolean(params.get("status")) ||
    Boolean(params.get("platform")) ||
    Boolean(params.get("userId")) ||
    Boolean(params.get("from")) ||
    Boolean(params.get("to"));

  function clearAll() {
    setSearch("");
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="content-search" className="sr-only">
          Search captions
        </label>
        <Input
          id="content-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search caption text…"
          className="h-9 bg-background/60 pl-9"
        />
      </div>

      <FilterSelect
        label="Status"
        value={params.get("status") ?? ALL}
        onChange={(v) => setFilter("status", v)}
        placeholder="All statuses"
        options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        className="w-[150px]"
      />

      <FilterSelect
        label="Platform"
        value={params.get("platform") ?? ALL}
        onChange={(v) => setFilter("platform", v)}
        placeholder="All platforms"
        options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_STYLE[p].label }))}
        className="w-[150px]"
      />

      <div className="flex items-center gap-1.5">
        <label htmlFor="content-from" className="sr-only">
          From date
        </label>
        <Input
          id="content-from"
          type="date"
          value={dateValue("from")}
          onChange={(e) => setDate("from", e.target.value)}
          aria-label="From date"
          className="h-9 w-[150px] bg-background/60"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <label htmlFor="content-to" className="sr-only">
          To date
        </label>
        <Input
          id="content-to"
          type="date"
          value={dateValue("to")}
          onChange={(e) => setDate("to", e.target.value)}
          aria-label="To date"
          className="h-9 w-[150px] bg-background/60"
        />
      </div>

      {hasFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="sm:ml-auto">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

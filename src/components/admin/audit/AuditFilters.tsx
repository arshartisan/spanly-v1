"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// URL-driven filter bar for the admin audit log (doc 15), mirroring <UserFilters/> /
// <EventFilters/>. All state lives in the query string so the RSC page does the actual
// querying; this component only writes to the URL. Text inputs are debounced; every
// change resets the cursor so pagination restarts cleanly.

const TEXT_KEYS = ["action", "actorQuery", "targetType"] as const;
const DATE_KEYS = ["from", "to"] as const;

export function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

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

  const setParam = useCallback(
    (key: string, value: string) => {
      writeParams((next) => {
        const trimmed = value.trim();
        if (trimmed) next.set(key, trimmed);
        else next.delete(key);
      });
    },
    [writeParams],
  );

  const hasFilters =
    TEXT_KEYS.some((k) => Boolean(params.get(k))) ||
    DATE_KEYS.some((k) => Boolean(params.get(k)));

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filter
      </div>

      <DebouncedInput
        urlKey="action"
        placeholder="Action (e.g. user.)"
        value={params.get("action") ?? ""}
        onCommit={setParam}
        className="min-w-[170px] flex-1"
      />
      <DebouncedInput
        urlKey="actorQuery"
        placeholder="Actor email or name…"
        value={params.get("actorQuery") ?? ""}
        onCommit={setParam}
        className="min-w-[170px] flex-1"
      />
      <DebouncedInput
        urlKey="targetType"
        placeholder="Target type (e.g. user)"
        value={params.get("targetType") ?? ""}
        onCommit={setParam}
        className="min-w-[150px]"
      />

      <DateInput
        label="From"
        value={params.get("from") ?? ""}
        onChange={(iso) => setParam("from", iso)}
      />
      <DateInput
        label="To"
        value={params.get("to") ?? ""}
        onChange={(iso) => setParam("to", iso)}
      />

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="sm:ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

/** Free-text input that debounces writes to a URL search param (mirrors UserFilters). */
function DebouncedInput({
  urlKey,
  value,
  onCommit,
  placeholder,
  className,
}: {
  urlKey: string;
  value: string;
  onCommit: (key: string, value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes externally (e.g. Clear).
  useEffect(() => {
    setLocal(value);
  }, [value]);

  function onChange(next: string) {
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onCommit(urlKey, next), 350);
  }

  return (
    <div className={className}>
      <label htmlFor={`audit-${urlKey}`} className="sr-only">
        {placeholder}
      </label>
      <Input
        id={`audit-${urlKey}`}
        value={local}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-background/60"
      />
    </div>
  );
}

/**
 * `<input type="date">` whose value (YYYY-MM-DD) is converted to/from an ISO datetime so
 * the URL carries the exact value the Zod schema's `isoDate` expects. Empty clears the param.
 */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  // value on the URL is a full ISO string; the date input wants YYYY-MM-DD.
  const dateValue = value ? value.slice(0, 10) : "";

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={`audit-date-${label}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <Input
        id={`audit-date-${label}`}
        type="date"
        value={dateValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? new Date(`${v}T00:00:00.000Z`).toISOString() : "");
        }}
        className="h-9 w-[150px] bg-background/60"
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Role, SubscriptionStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL, STATUS_LABEL } from "./display";
import { DEFAULT_PLANS as PLANS, DEFAULT_PLAN_KEYS } from "@/lib/plan-defaults";

// URL-driven filter bar for the admin user list (doc 16). All state lives in the query
// string so the RSC page does the actual querying; this component only writes to the URL.
// Search is debounced; every change resets the cursor so pagination restarts cleanly.

const ALL = "all";

const ROLES = Object.values(Role);
const PLAN_KEYS = DEFAULT_PLAN_KEYS;
const STATUSES = Object.values(SubscriptionStatus);

const BOOL_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export function UserFilters() {
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

  const hasFilters =
    Boolean(params.get("query")) ||
    Boolean(params.get("role")) ||
    Boolean(params.get("plan")) ||
    Boolean(params.get("status")) ||
    Boolean(params.get("suspended")) ||
    Boolean(params.get("verified"));

  function clearAll() {
    setSearch("");
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <Input
          id="user-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search email, name, or id…"
          className="h-9 bg-background/60 pl-9"
        />
      </div>

      <FilterSelect
        label="Role"
        value={params.get("role") ?? ALL}
        onChange={(v) => setFilter("role", v)}
        placeholder="All roles"
        options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        className="w-[140px]"
      />

      <FilterSelect
        label="Plan"
        value={params.get("plan") ?? ALL}
        onChange={(v) => setFilter("plan", v)}
        placeholder="All plans"
        options={PLAN_KEYS.map((p) => ({ value: p, label: PLANS[p].name }))}
        className="w-[140px]"
      />

      <FilterSelect
        label="Subscription status"
        value={params.get("status") ?? ALL}
        onChange={(v) => setFilter("status", v)}
        placeholder="All statuses"
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        className="w-[150px]"
      />

      <FilterSelect
        label="Suspended"
        value={params.get("suspended") ?? ALL}
        onChange={(v) => setFilter("suspended", v)}
        placeholder="Suspended?"
        options={BOOL_OPTIONS}
        className="w-[140px]"
      />

      <FilterSelect
        label="Verified"
        value={params.get("verified") ?? ALL}
        onChange={(v) => setFilter("verified", v)}
        placeholder="Verified?"
        options={BOOL_OPTIONS}
        className="w-[140px]"
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

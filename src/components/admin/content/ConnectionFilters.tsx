"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { AccountStatus, Platform } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { ACCOUNT_STATUS_LABEL } from "./display";

// URL-driven filter bar for the admin connections list (doc 18), mirroring
// <SubscriptionFilters/>. All state lives in the query string so the RSC page does the
// query; this component only writes to the URL.

const ALL = "all";

const PLATFORMS = Object.values(Platform);
const STATUSES = Object.values(AccountStatus);

const TOKEN_HEALTH = [
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expiring ≤24h" },
];

export function ConnectionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const writeParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
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

  const hasFilters =
    Boolean(params.get("platform")) ||
    Boolean(params.get("status")) ||
    Boolean(params.get("tokenHealth"));

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <FilterSelect
        label="Platform"
        value={params.get("platform") ?? ALL}
        onChange={(v) => setFilter("platform", v)}
        placeholder="All platforms"
        options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_STYLE[p].label }))}
        className="w-[150px]"
      />

      <FilterSelect
        label="Account status"
        value={params.get("status") ?? ALL}
        onChange={(v) => setFilter("status", v)}
        placeholder="All statuses"
        options={STATUSES.map((s) => ({ value: s, label: ACCOUNT_STATUS_LABEL[s] }))}
        className="w-[150px]"
      />

      <FilterSelect
        label="Token health"
        value={params.get("tokenHealth") ?? ALL}
        onChange={(v) => setFilter("tokenHealth", v)}
        placeholder="Any token health"
        options={TOKEN_HEALTH}
        className="w-[170px]"
      />

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

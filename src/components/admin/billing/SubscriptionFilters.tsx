"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { BillingInterval, PlanKey, SubscriptionStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL } from "@/components/admin/users/display";
import { PLANS } from "@/server/plans";

// URL-driven filter bar for the admin subscriptions list (doc 17), mirroring
// <UserFilters/>. All state lives in the query string so the RSC page does the query;
// this component only writes to the URL.

const ALL = "all";

const STATUSES = Object.values(SubscriptionStatus);
const PLAN_KEYS = Object.values(PlanKey);
const INTERVALS = Object.values(BillingInterval);

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Monthly",
  year: "Yearly",
};

export function SubscriptionFilters() {
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
    Boolean(params.get("status")) ||
    Boolean(params.get("plan")) ||
    Boolean(params.get("interval"));

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <FilterSelect
        label="Subscription status"
        value={params.get("status") ?? ALL}
        onChange={(v) => setFilter("status", v)}
        placeholder="All statuses"
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        className="w-[160px]"
      />

      <FilterSelect
        label="Plan"
        value={params.get("plan") ?? ALL}
        onChange={(v) => setFilter("plan", v)}
        placeholder="All plans"
        options={PLAN_KEYS.map((p) => ({ value: p, label: PLANS[p].name }))}
        className="w-[150px]"
      />

      <FilterSelect
        label="Billing interval"
        value={params.get("interval") ?? ALL}
        onChange={(v) => setFilter("interval", v)}
        placeholder="All intervals"
        options={INTERVALS.map((i) => ({ value: i, label: INTERVAL_LABEL[i] }))}
        className="w-[150px]"
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

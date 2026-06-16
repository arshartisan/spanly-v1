"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// URL-driven filter bar for the webhook event log (doc 19), mirroring
// <ConnectionFilters/>. The source filter lives in the query string; the RSC page
// reads it and calls listWebhookEvents().

const ALL = "all";

const SOURCES = [
  { value: "stripe", label: "Stripe" },
  { value: "user_webhook", label: "User webhook" },
];

export function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      // Changing a filter resets pagination.
      next.delete("cursor");
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const hasFilters = Boolean(params.get("source"));

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={params.get("source") ?? ALL} onValueChange={(v) => setFilter("source", v)}>
        <SelectTrigger aria-label="Source" className="w-[180px]">
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sources</SelectItem>
          {SOURCES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="sm:ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

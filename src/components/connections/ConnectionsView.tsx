"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlatformRow } from "./PlatformRow";
import type { AccountVM } from "./AccountChip";

export interface ConnectionsNotice {
  type: "success" | "error";
  text: string;
}

/**
 * Connections page body (docs/implementation/05). Owns the "Show IDs" toggle and the platform
 * filter; renders one PlatformRow per platform. Banners come from the connect/callback
 * redirect (?connected / ?error) and are passed in from the server.
 */
export function ConnectionsView({
  accounts,
  used,
  limit,
  notice,
}: {
  accounts: AccountVM[];
  used: number;
  limit: number | null; // null = unlimited (Pro)
  notice: ConnectionsNotice | null;
}) {
  const [showIds, setShowIds] = useState(false);
  const [filter, setFilter] = useState("");

  const byPlatform = useMemo(() => {
    const map = new Map<PlatformKey, AccountVM[]>();
    for (const p of PLATFORMS) map.set(p, []);
    for (const a of accounts) map.get(a.platform as PlatformKey)?.push(a);
    return map;
  }, [accounts]);

  const limitReached = limit !== null && used >= limit;

  const visible = PLATFORMS.filter((p) =>
    PLATFORM_STYLE[p].label.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connected Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Link your social accounts to schedule and publish from Spanly.{" "}
          <span className={cn("font-medium", limitReached && "text-destructive")}>
            {used} / {limit === null ? "∞" : limit} accounts
          </span>
        </p>
      </header>

      {notice && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
            notice.type === "success"
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {notice.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter platforms…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="sm:max-w-xs"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showIds}
            onChange={(e) => setShowIds(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Show account IDs
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((p) => (
          <PlatformRow
            key={p}
            platform={p}
            accounts={byPlatform.get(p) ?? []}
            showIds={showIds}
            limitReached={limitReached}
          />
        ))}
        {visible.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No platforms match “{filter}”.
          </p>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Need a hand?{" "}
        <span className="text-primary">Get help connecting your accounts</span> (coming soon).
      </p>
    </div>
  );
}

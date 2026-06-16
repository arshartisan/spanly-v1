"use client";

import { CheckCircle2 } from "lucide-react";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { ConnectButton } from "./ConnectButton";
import { AccountChip, type AccountVM } from "./AccountChip";

/**
 * One glass tile per platform (docs/implementation/05): icon + status header, connected-account
 * chips, then a full-width Connect button. Laid out in a responsive grid by ConnectionsView.
 * Reconnecting an already-linked platform is always allowed, so the button only disables at the
 * plan limit when this platform has no live account.
 */
export function PlatformRow({
  platform,
  accounts,
  showIds,
  limitReached,
}: {
  platform: PlatformKey;
  accounts: AccountVM[];
  showIds: boolean;
  limitReached: boolean;
}) {
  const style = PLATFORM_STYLE[platform];
  const Icon = style.Icon;
  const cfg = PLATFORM_CONFIG[platform];
  const disabled = limitReached && accounts.length === 0;
  const connected = accounts.length > 0;

  return (
    <div className="glass flex h-full flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: style.color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">{style.label}</p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? `${accounts.length} account${accounts.length > 1 ? "s" : ""} connected`
                : "Not connected"}
            </p>
          </div>
        </div>
        {connected && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-status-posted/10 px-2 py-0.5 text-[11px] font-medium text-status-posted">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </span>
        )}
      </div>

      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          {accounts.map((a) => (
            <AccountChip key={a.id} account={a} showId={showIds} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
          No account connected yet
        </p>
      )}

      <ConnectButton
        platform={platform}
        label={style.label}
        hasMethodChoice={cfg.hasConnectMethodChoice}
        disabled={disabled}
        className="mt-auto w-full"
      />
    </div>
  );
}

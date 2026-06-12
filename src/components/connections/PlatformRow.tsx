"use client";

import { PLATFORM_STYLE } from "@/lib/platform-style";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { ConnectButton } from "./ConnectButton";
import { AccountChip, type AccountVM } from "./AccountChip";

/**
 * One row per platform (docs/implementation/05): icon + Connect button + connected-account
 * chips. Reconnecting an already-linked platform is always allowed, so the button only
 * disables at the plan limit when this platform has no live account.
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: style.color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium leading-tight">{style.label}</p>
          <p className="text-xs text-muted-foreground">
            {accounts.length === 0
              ? "Not connected"
              : `${accounts.length} account${accounts.length > 1 ? "s" : ""} connected`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {accounts.map((a) => (
          <AccountChip key={a.id} account={a} showId={showIds} />
        ))}
        <ConnectButton
          platform={platform}
          label={style.label}
          hasMethodChoice={cfg.hasConnectMethodChoice}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, RotateCw, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { computeExpiry, type ExpiryLevel } from "@/lib/account-expiry";
import { cn } from "@/lib/utils";

export interface AccountVM {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  externalId: string;
  status: "active" | "expired" | "error";
  /** ISO string of the token expiry, or null when the token never expires. */
  tokenExpiresAt: string | null;
}

const STATUS_DOT: Record<ExpiryLevel, string> = {
  active: "bg-emerald-500",
  expiring: "bg-amber-500",
  expired: "bg-red-500",
};

const STATUS_TEXT: Record<ExpiryLevel, string> = {
  active: "text-muted-foreground",
  expiring: "text-amber-600",
  expired: "text-red-600",
};

/**
 * Connected-account chip (docs/implementation/05): avatar + handle + token-health.
 * Surfaces when the token expires ("Expires in 3 days") and offers the right fix:
 *  • expiring  → Refresh (silent token renew via the provider).
 *  • expired   → Reconnect (full OAuth re-login — the only fix once the refresh token is dead).
 * Mutations hit the API / OAuth start route, then refresh the server component to re-read state.
 */
export function AccountChip({ account, showId }: { account: AccountVM; showId: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const expiry = computeExpiry(account.tokenExpiresAt, account.status);
  const showExpiry = expiry.level !== "active" || account.tokenExpiresAt !== null;

  async function disconnect() {
    if (busy) return;
    if (!confirm(`Disconnect ${account.handle}? Posted history is kept.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}/refresh`, { method: "POST" });
      if (res.ok) router.refresh();
      else reconnect(); // refresh token is dead too — fall back to full OAuth.
    } finally {
      setBusy(false);
    }
  }

  // Full OAuth re-login. Re-running the connect flow re-mints tokens for the same account
  // (upserted on the unique [userId, platform, externalId]); for Instagram the provider
  // defaults the method when none is passed.
  function reconnect() {
    window.location.href = `/api/connect/${account.platform}/start`;
  }

  const initial = account.handle.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2 text-sm",
        expiry.level === "expired" && "border-red-500/40",
        expiry.level === "expiring" && "border-amber-500/40",
        busy && "opacity-60",
      )}
    >
      <Avatar className="h-6 w-6">
        {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.handle} />}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>

      <span className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[expiry.level])} />
        <span className="font-medium">{account.handle}</span>
      </span>

      {showExpiry && (
        <span
          className={cn("text-xs", STATUS_TEXT[expiry.level])}
          title={expiry.exact ? `Token expires ${expiry.exact}` : undefined}
        >
          {expiry.label}
        </span>
      )}

      {showId && <span className="text-xs text-muted-foreground">{account.externalId}</span>}

      {expiry.level === "expiring" && (
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          title="Refresh connection"
          aria-busy={busy || undefined}
          className="ml-1 rounded-full p-0.5 text-amber-600 hover:bg-amber-500/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      )}

      {expiry.level === "expired" && (
        <button
          type="button"
          onClick={reconnect}
          disabled={busy}
          title="Reconnect (sign in again)"
          className="ml-1 flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/20"
        >
          <RotateCw className="h-3 w-3" />
          Reconnect
        </button>
      )}

      <button
        type="button"
        onClick={disconnect}
        disabled={busy}
        title="Disconnect"
        aria-label={`Disconnect ${account.handle}`}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

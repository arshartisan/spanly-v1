"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface AccountVM {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  externalId: string;
  status: "active" | "expired" | "error";
}

const STATUS_DOT: Record<AccountVM["status"], string> = {
  active: "bg-emerald-500",
  expired: "bg-amber-500",
  error: "bg-red-500",
};

/**
 * Connected-account chip (docs/implementation/05): avatar + handle, a Refresh affordance when
 * the token isn't active, and a × to disconnect (soft-delete). Mutations hit the API then
 * refresh the server component to re-read state.
 */
export function AccountChip({ account, showId }: { account: AccountVM; showId: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
    } finally {
      setBusy(false);
    }
  }

  const initial = account.handle.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2 text-sm",
        busy && "opacity-60",
      )}
    >
      <Avatar className="h-6 w-6">
        {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.handle} />}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>

      <span className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[account.status])} />
        <span className="font-medium">{account.handle}</span>
      </span>

      {showId && <span className="text-xs text-muted-foreground">{account.externalId}</span>}

      {account.status !== "active" && (
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          title="Refresh connection"
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
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

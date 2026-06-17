"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Force-disconnect action for a row on the admin connections list (doc 18). Opens a confirm
// popover with a required reason, posts to the disconnect API, and router.refresh()es on
// success. Surfaces the affected pending-target count so staff understand the blast radius.
// Mirrors <RefundActions/> / <UserActions/>. Tokens are never touched here.

export function ForceDisconnect({
  accountId,
  handle,
  pendingTargets,
}: {
  accountId: string;
  handle: string;
  pendingTargets: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/connections/${accountId}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Action failed.");
        return;
      }
      setReason("");
      setTouched(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Force-disconnect {handle}</p>
            <p className="text-xs text-muted-foreground">
              Soft-deletes the account so its post history is kept. The user will need to
              reconnect to publish again.
            </p>
          </div>
          {pendingTargets > 0 ? (
            <p className="rounded-lg border border-status-draft/30 bg-status-draft/10 px-2.5 py-2 text-[11px] text-status-draft">
              {pendingTargets} pending{" "}
              {pendingTargets === 1 ? "target" : "targets"} for this account will fail when the
              worker tries to publish.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`disconnect-reason-${accountId}`}>Reason</Label>
            <textarea
              id={`disconnect-reason-${accountId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              aria-invalid={touched && !reason.trim()}
              autoFocus
              className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Abusive account, report #1234…"
            />
            {touched && !reason.trim() ? (
              <p className="text-[11px] text-status-failed">A reason is required.</p>
            ) : null}
          </div>
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Dismiss
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              loading={pending}
              disabled={!reason.trim()}
            >
              Disconnect
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

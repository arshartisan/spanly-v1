"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Approve / Deny actions for a pending refund request (doc 17). Each opens a popover with
// an inline form, posts to the refund API, surfaces inline errors, and router.refresh()es
// the RSC on success. The out-of-policy "force" checkbox is rendered only for superadmins.

export function RefundActions({
  requestId,
  viewerIsSuperadmin,
}: {
  requestId: string;
  viewerIsSuperadmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <ApprovePopover
        requestId={requestId}
        viewerIsSuperadmin={viewerIsSuperadmin}
        pending={pending === "approve"}
        disabled={pending !== null}
        onPendingChange={(p) => setPending(p ? "approve" : null)}
        onSuccess={() => router.refresh()}
      />
      <DenyPopover
        requestId={requestId}
        pending={pending === "deny"}
        disabled={pending !== null}
        onPendingChange={(p) => setPending(p ? "deny" : null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

async function post(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? "Action failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

function ApprovePopover({
  requestId,
  viewerIsSuperadmin,
  pending,
  disabled,
  onPendingChange,
  onSuccess,
}: {
  requestId: string;
  viewerIsSuperadmin: boolean;
  pending: boolean;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    onPendingChange(true);
    const body: Record<string, unknown> = {};
    if (note.trim()) body.note = note.trim();
    if (viewerIsSuperadmin && force) body.force = true;
    const result = await post(`/api/admin/refunds/${requestId}/approve`, body);
    onPendingChange(false);
    if (result.ok) {
      setNote("");
      setForce(false);
      setOpen(false);
      onSuccess();
    } else {
      setError(result.error);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-status-posted/40 text-status-posted hover:bg-status-posted/10 hover:text-status-posted"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Approve &amp; refund</p>
            <p className="text-xs text-muted-foreground">
              Issues the refund and marks the request refunded.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`approve-note-${requestId}`}>Note (optional)</Label>
            <textarea
              id={`approve-note-${requestId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Internal note for the audit log…"
            />
          </div>
          {viewerIsSuperadmin ? (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-[hsl(var(--primary))]"
              />
              <span>
                Force out-of-policy refund (outside the {""}
                refund window). Recorded as out-of-policy in the audit log.
              </span>
            </label>
          ) : null}
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Approve
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function DenyPopover({
  requestId,
  pending,
  disabled,
  onPendingChange,
  onSuccess,
}: {
  requestId: string;
  pending: boolean;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!note.trim()) return;
    setError(null);
    onPendingChange(true);
    const result = await post(`/api/admin/refunds/${requestId}/deny`, { note: note.trim() });
    onPendingChange(false);
    if (result.ok) {
      setNote("");
      setTouched(false);
      setOpen(false);
      onSuccess();
    } else {
      setError(result.error);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          <X className="h-3.5 w-3.5" />
          Deny
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Deny refund</p>
            <p className="text-xs text-muted-foreground">
              The request is marked denied. A reason is required.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`deny-note-${requestId}`}>Reason</Label>
            <textarea
              id={`deny-note-${requestId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              aria-invalid={touched && !note.trim()}
              autoFocus
              className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Outside refund policy, usage detected…"
            />
            {touched && !note.trim() ? (
              <p className="text-[11px] text-status-failed">A reason is required.</p>
            ) : null}
          </div>
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={pending || !note.trim()}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Deny
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

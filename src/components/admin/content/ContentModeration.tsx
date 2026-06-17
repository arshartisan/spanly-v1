"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Trash2 } from "lucide-react";
import type { PostStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Cancel + Takedown moderation actions for the admin post detail (doc 18). Each opens a
// popover with a required reason textarea, posts to the moderation API, surfaces inline
// errors, and router.refresh()es the RSC on success. Mirrors <RefundActions/>. Visibility
// is gated on canModerate; Cancel is only valid for scheduled/publishing posts.

const CANCELLABLE: ReadonlySet<PostStatus> = new Set<PostStatus>(["scheduled", "publishing"]);
const TERMINAL: ReadonlySet<PostStatus> = new Set<PostStatus>(["canceled", "removed"]);

async function post(
  url: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
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

export function ContentModeration({
  postId,
  status,
  canModerate,
  pendingTargets,
}: {
  postId: string;
  status: PostStatus;
  canModerate: boolean;
  pendingTargets: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "takedown" | null>(null);

  if (!canModerate) return null;

  const canCancel = CANCELLABLE.has(status);
  const canTakedown = !TERMINAL.has(status);

  // Nothing actionable: post already canceled/removed.
  if (!canCancel && !canTakedown) {
    return (
      <p className="text-xs text-muted-foreground">
        This post is {status === "removed" ? "removed" : "canceled"} - no further moderation
        actions are available.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCancel ? (
        <ActionPopover
          variant="cancel"
          trigger={
            <>
              <Ban className="h-3.5 w-3.5" />
              Cancel scheduled
            </>
          }
          title="Cancel scheduled post"
          description={`Removes the queued jobs and marks ${pendingTargets} pending ${
            pendingTargets === 1 ? "target" : "targets"
          } as canceled. Targets already sent are left untouched.`}
          confirmLabel="Cancel post"
          pending={pending === "cancel"}
          disabled={pending !== null}
          onPendingChange={(p) => setPending(p ? "cancel" : null)}
          submit={(reason) => post(`/api/admin/content/${postId}/cancel`, reason)}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      {canTakedown ? (
        <ActionPopover
          variant="takedown"
          trigger={
            <>
              <Trash2 className="h-3.5 w-3.5" />
              Takedown
            </>
          }
          title="Takedown post"
          description="Marks the post removed and cancels any pending targets."
          caveat="A takedown cannot un-publish a post already sent to a platform - Spanlyfy only relays content. Already-published targets stay live; remove them from the platform directly."
          confirmLabel="Take down"
          pending={pending === "takedown"}
          disabled={pending !== null}
          onPendingChange={(p) => setPending(p ? "takedown" : null)}
          submit={(reason) => post(`/api/admin/content/${postId}/takedown`, reason)}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function ActionPopover({
  variant,
  trigger,
  title,
  description,
  caveat,
  confirmLabel,
  pending,
  disabled,
  onPendingChange,
  submit,
  onSuccess,
}: {
  variant: "cancel" | "takedown";
  trigger: React.ReactNode;
  title: string;
  description: string;
  caveat?: string;
  confirmLabel: string;
  pending: boolean;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  submit: (reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    setError(null);
    onPendingChange(true);
    const result = await submit(reason.trim());
    onPendingChange(false);
    if (result.ok) {
      setReason("");
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
          {trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {caveat ? (
            <div className="flex items-start gap-2 rounded-lg border border-status-draft/30 bg-status-draft/10 px-2.5 py-2 text-[11px] text-status-draft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{caveat}</span>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${variant}-reason`}>Reason</Label>
            <textarea
              id={`${variant}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              aria-invalid={touched && !reason.trim()}
              autoFocus
              className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Policy violation report #1234…"
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
              {confirmLabel}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

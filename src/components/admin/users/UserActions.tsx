"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Action toolbar for the user detail (doc 16). Each button hits a mutation API route then
// router.refresh()es to re-read the RSC. Destructive / input-requiring actions (suspend,
// edit) open a popover with an inline form instead of window.confirm. Per-action pending
// + inline success/error feedback; no global spinner.

export interface UserActionsUser {
  id: string;
  email: string;
  displayName: string | null;
  suspended: boolean;
  verified: boolean;
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

export function UserActions({ user }: { user: UserActionsUser }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function run(
    action: string,
    url: string,
    body?: Record<string, unknown>,
    successMessage?: string,
  ): Promise<boolean> {
    if (pending) return false;
    setPending(action);
    setFeedback(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setFeedback({ kind: "error", message: data?.error ?? "Action failed." });
        return false;
      }
      setFeedback({ kind: "ok", message: successMessage ?? "Done." });
      router.refresh();
      return true;
    } catch {
      setFeedback({ kind: "error", message: "Network error. Please try again." });
      return false;
    } finally {
      setPending(null);
    }
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (pending) return false;
    setPending("edit");
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setFeedback({ kind: "error", message: data?.error ?? "Could not save changes." });
        return false;
      }
      setFeedback({ kind: "ok", message: "Profile updated." });
      router.refresh();
      return true;
    } catch {
      setFeedback({ kind: "error", message: "Network error. Please try again." });
      return false;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <EditProfilePopover user={user} pending={pending === "edit"} onSave={patch} />

        {user.suspended ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() =>
              run(
                "unsuspend",
                `/api/admin/users/${user.id}/unsuspend`,
                undefined,
                "Account restored.",
              )
            }
          >
            {pending === "unsuspend" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Unsuspend
          </Button>
        ) : (
          <SuspendPopover
            pending={pending === "suspend"}
            disabled={pending !== null}
            onConfirm={(reason) =>
              run(
                "suspend",
                `/api/admin/users/${user.id}/suspend`,
                { reason },
                "Account suspended.",
              )
            }
          />
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null || user.verified}
          onClick={() =>
            run(
              "verify",
              `/api/admin/users/${user.id}/verify-email`,
              undefined,
              "Email marked as verified.",
            )
          }
          title={user.verified ? "Email is already verified" : undefined}
        >
          {pending === "verify" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BadgeCheck className="h-3.5 w-3.5" />
          )}
          {user.verified ? "Verified" : "Force-verify"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() =>
            run(
              "reset",
              `/api/admin/users/${user.id}/send-reset`,
              undefined,
              "Password-reset email sent.",
            )
          }
        >
          {pending === "reset" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          Send reset
        </Button>

        <SignOutAllPopover
          pending={pending === "signout"}
          disabled={pending !== null}
          onConfirm={() =>
            run(
              "signout",
              `/api/admin/users/${user.id}/signout-all`,
              undefined,
              "All sessions revoked.",
            )
          }
        />
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "text-xs",
            feedback.kind === "ok" ? "text-status-posted" : "text-status-failed",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function EditProfilePopover({
  user,
  pending,
  onSave,
}: {
  user: UserActionsUser;
  pending: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [email, setEmail] = useState(user.email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    const nextName = displayName.trim();
    const nextEmail = email.trim();
    if (nextName && nextName !== (user.displayName ?? "")) body.displayName = nextName;
    if (nextEmail && nextEmail.toLowerCase() !== user.email.toLowerCase()) body.email = nextEmail;
    if (Object.keys(body).length === 0) {
      setOpen(false);
      return;
    }
    const ok = await onSave(body);
    if (ok) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Display name</Label>
            <Input
              id="edit-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="h-9 bg-background/60"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 bg-background/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Changing the email re-triggers verification.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function SuspendPopover({
  pending,
  disabled,
  onConfirm,
}: {
  pending: boolean;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    const ok = await onConfirm(reason.trim());
    if (ok) {
      setReason("");
      setTouched(false);
      setOpen(false);
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
          <Ban className="h-3.5 w-3.5" />
          Suspend
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-status-failed">
            <ShieldCheck className="h-4 w-4" />
            Suspend account
          </div>
          <p className="text-xs text-muted-foreground">
            The user will be blocked from signing in and new publishes are paused.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Abuse report #1234"
              aria-invalid={touched && !reason.trim()}
              className="h-9 bg-background/60"
              autoFocus
            />
            {touched && !reason.trim() ? (
              <p className="text-[11px] text-status-failed">A reason is required.</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={pending || !reason.trim()}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Suspend
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function SignOutAllPopover({
  pending,
  disabled,
  onConfirm,
}: {
  pending: boolean;
  disabled: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  async function confirm() {
    const ok = await onConfirm();
    if (ok) setOpen(false);
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
          <LogOut className="h-3.5 w-3.5" />
          Sign out all
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Sign out everywhere?</p>
          <p className="text-xs text-muted-foreground">
            This revokes every active session for this user. They will need to sign in again on
            all devices.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Sign out all
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

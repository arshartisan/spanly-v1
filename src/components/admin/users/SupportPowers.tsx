"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Loader2,
  ShieldAlert,
  Trash2,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Danger zone — superadmin (doc 21). Three high-blast-radius support powers, each behind a
// Popover requiring a typed reason (mirrors SuspendPopover in UserActions.tsx): impersonate,
// GDPR anonymize, and hard delete. Each POSTs/DELETEs to its API route, shows per-action
// pending + inline feedback, and surfaces server errors (e.g. the 409 active-subscription
// guard on delete) verbatim. Rendered ONLY when the viewer is superadmin (gated by the page).

export interface SupportPowersUser {
  id: string;
  email: string;
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

export function SupportPowers({
  user,
  targetIsStaff,
}: {
  user: SupportPowersUser;
  targetIsStaff: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  /** Shared request runner. Returns the parsed error message on failure, or null on success. */
  async function send(
    action: string,
    url: string,
    method: "POST" | "DELETE",
    reason?: string,
  ): Promise<string | null> {
    if (pending) return "Another action is in progress.";
    setPending(action);
    setFeedback(null);
    try {
      const res = await fetch(url, {
        method,
        headers: reason ? { "Content-Type": "application/json" } : undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        return data?.error ?? "Action failed.";
      }
      return null;
    } catch {
      return "Network error. Please try again.";
    } finally {
      setPending(null);
    }
  }

  async function impersonate(reason: string): Promise<boolean> {
    // The impersonate route requires no body, but we keep the reason-gated UX for consistency
    // and audit intent; the cookie swaps server-side, so we hard-navigate to /dashboard.
    void reason;
    const err = await send(
      "impersonate",
      `/api/admin/users/${user.id}/impersonate`,
      "POST",
    );
    if (err) {
      setFeedback({ kind: "error", message: err });
      return false;
    }
    window.location.href = "/dashboard";
    return true;
  }

  async function anonymize(reason: string): Promise<boolean> {
    const err = await send(
      "anonymize",
      `/api/admin/users/${user.id}/anonymize`,
      "POST",
      reason,
    );
    if (err) {
      setFeedback({ kind: "error", message: err });
      return false;
    }
    setFeedback({ kind: "ok", message: "User anonymized. PII scrubbed and access revoked." });
    router.refresh();
    return true;
  }

  async function deleteAccount(reason: string): Promise<boolean> {
    const err = await send("delete", `/api/admin/users/${user.id}`, "DELETE", reason);
    if (err) {
      setFeedback({ kind: "error", message: err });
      return false;
    }
    // The detail page no longer exists — navigate back to the list.
    window.location.href = "/admin/users";
    return true;
  }

  return (
    <div className="rounded-2xl border border-status-failed/30 bg-status-failed/[0.06] p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-status-failed">
          <ShieldAlert className="h-4 w-4" />
          Danger zone — superadmin
        </div>
        <p className="text-xs text-muted-foreground">
          High-blast-radius support powers. Every action is audited and requires a typed reason.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ImpersonatePopover
          email={user.email}
          targetIsStaff={targetIsStaff}
          pending={pending === "impersonate"}
          disabled={pending !== null}
          onConfirm={impersonate}
        />
        <AnonymizePopover
          pending={pending === "anonymize"}
          disabled={pending !== null}
          onConfirm={anonymize}
        />
        <DeletePopover
          pending={pending === "delete"}
          disabled={pending !== null}
          onConfirm={deleteAccount}
        />
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-xs",
            feedback.kind === "ok" ? "text-status-posted" : "text-status-failed",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────── Shared reason form ───────────────────────────

function ReasonForm({
  icon: Icon,
  title,
  description,
  placeholder,
  confirmLabel,
  inputId,
  pending,
  onConfirm,
  onCancel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
  placeholder: string;
  confirmLabel: string;
  inputId: string;
  pending: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
  onCancel: () => void;
}) {
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
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-status-failed">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Reason</Label>
        <Input
          id={inputId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          aria-invalid={touched && !reason.trim()}
          maxLength={500}
          className="h-9 bg-background/60"
          autoFocus
        />
        {touched && !reason.trim() ? (
          <p className="text-[11px] text-status-failed">A reason is required.</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending || !reason.trim()}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── Impersonate ───────────────────────────

function ImpersonatePopover({
  email,
  targetIsStaff,
  pending,
  disabled,
  onConfirm,
}: {
  email: string;
  targetIsStaff: boolean;
  pending: boolean;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  if (targetIsStaff) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="border-status-failed/40 text-status-failed/60"
        title="Staff accounts cannot be impersonated."
      >
        <Eye className="h-3.5 w-3.5" />
        Impersonate
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          <Eye className="h-3.5 w-3.5" />
          Impersonate
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ReasonForm
          icon={UserCog}
          title="Log in as this user"
          description={
            <>
              You will view the app as <span className="font-medium text-foreground">{email}</span>.
              A persistent banner shows while impersonating. Billing actions stay blocked, and both
              start &amp; exit are audited.
            </>
          }
          placeholder="e.g. Debugging publish failure for ticket #1234"
          confirmLabel="Start impersonating"
          inputId="impersonate-reason"
          pending={pending}
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────── Anonymize (GDPR) ───────────────────────────

function AnonymizePopover({
  pending,
  disabled,
  onConfirm,
}: {
  pending: boolean;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          <UserCog className="h-3.5 w-3.5" />
          Anonymize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ReasonForm
          icon={ShieldAlert}
          title="Anonymize (GDPR erasure)"
          description={
            <>
              Scrubs all PII (email, name, avatar), revokes every session &amp; API key, and
              disconnects social accounts. Financial &amp; audit records are kept. This cannot be
              undone.
            </>
          }
          placeholder="e.g. GDPR erasure request #5678"
          confirmLabel="Anonymize user"
          inputId="anonymize-reason"
          pending={pending}
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────── Delete ───────────────────────────

function DeletePopover({
  pending,
  disabled,
  onConfirm,
}: {
  pending: boolean;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete account
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ReasonForm
          icon={Trash2}
          title="Hard-delete account"
          description={
            <>
              Permanently deletes the user and cascades all related data. This is blocked while a
              paid subscription is still active — cancel it first. Prefer Anonymize unless deletion
              is legally required.
            </>
          }
          placeholder="e.g. Legal erasure order — case #9012"
          confirmLabel="Delete account"
          inputId="delete-reason"
          pending={pending}
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";

// Persistent "viewing as" banner shown app-wide whenever the session is an impersonation
// (doc 21). High-visibility amber/orange bar, NOT dismissible. The Exit button POSTs
// /api/admin/impersonate/stop (which restores the staff session cookie) then hard-navigates
// to /admin so the staff identity + admin shell take effect. Rendered by the app layout only
// when getSessionContext() reports an impersonatorId.

export function ImpersonationBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate/stop", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not exit impersonation.");
        setPending(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200"
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        <span className="leading-snug">
          You are viewing as{" "}
          <span className="font-semibold text-amber-100">{email}</span> - staff impersonation.
        </span>
        {error ? <span className="text-xs text-status-failed">{error}</span> : null}
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={pending}
        className="press inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        Exit
      </button>
    </div>
  );
}

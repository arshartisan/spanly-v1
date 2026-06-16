"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Create-announcement form for the admin settings (doc 20). Controlled inputs mirroring
// announcementCreateSchema (message required; severity info|warning|critical; audience
// all|trialing|plan:<key>; optional start/end window). POSTs to
// /api/admin/settings/announcements and router.refresh()es on success. Mirrors the
// <RunMaintenance/> / <ContentModeration/> client action pattern.

const SEVERITIES = ["info", "warning", "critical"] as const;
type Severity = (typeof SEVERITIES)[number];

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "trialing", label: "Trialing users" },
  { value: "plan:creator", label: "Creator plan" },
  { value: "plan:growth", label: "Growth plan" },
  { value: "plan:pro", label: "Pro plan" },
] as const;

const inputClass =
  "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AnnouncementForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [audience, setAudience] = useState<string>("all");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messageInvalid = touched && message.trim().length === 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (message.trim().length === 0) return;
    setError(null);
    setPending(true);
    try {
      // datetime-local has no timezone; toISOString() makes it a valid ISO string for the schema.
      const body: {
        message: string;
        severity: Severity;
        audience: string;
        startsAt?: string;
        endsAt?: string;
      } = {
        message: message.trim(),
        severity,
        audience,
      };
      if (startsAt) body.startsAt = new Date(startsAt).toISOString();
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();

      const res = await fetch("/api/admin/settings/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not create the announcement.");
        return;
      }
      // Reset to defaults and refresh the list.
      setMessage("");
      setSeverity("info");
      setAudience("all");
      setStartsAt("");
      setEndsAt("");
      setTouched(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ann-message">Message</Label>
        <textarea
          id="ann-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          aria-invalid={messageInvalid}
          placeholder="e.g. Scheduled maintenance on Sunday 02:00–04:00 UTC."
          className={inputClass}
        />
        <div className="flex items-center justify-between">
          {messageInvalid ? (
            <p className="text-[11px] text-status-failed">A message is required.</p>
          ) : (
            <span />
          )}
          <span className="text-[11px] text-muted-foreground tabular-nums">{message.length}/500</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-severity">Severity</Label>
          <select
            id="ann-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className={inputClass}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-audience">Audience</Label>
          <select
            id="ann-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={inputClass}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-starts">Starts at (optional)</Label>
          <input
            id="ann-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-ends">Ends at (optional)</Label>
          <input
            id="ann-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Leave the window empty for an open-ended announcement. Times use your local timezone.
      </p>

      {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Megaphone className="h-3.5 w-3.5" />
          )}
          {pending ? "Publishing…" : "Publish announcement"}
        </Button>
      </div>
    </form>
  );
}

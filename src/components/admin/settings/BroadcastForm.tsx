"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { broadcastSchema } from "@/lib/schemas/admin-support";

// Broadcast composer (doc 21, superadmin). Audience grammar matches broadcastSchema /
// buildAudienceWhere: all | trialing | plan:<key> | ids:<comma ids>. The `ids:` option
// reveals a free-text field whose value is prefixed into the audience string. Subject + body
// are required (validated client-side via broadcastSchema before POST). POSTs to
// /api/admin/broadcast and reports recipientCount on success. Mirrors AnnouncementForm.

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "trialing", label: "Trialing users" },
  { value: "plan:creator", label: "Creator plan" },
  { value: "plan:growth", label: "Growth plan" },
  { value: "plan:pro", label: "Pro plan" },
  { value: "ids", label: "Specific user IDs…" },
] as const;

const inputClass =
  "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Result = { kind: "ok"; count: number } | { kind: "error"; message: string } | null;

export function BroadcastForm() {
  const [audienceChoice, setAudienceChoice] = useState<string>("all");
  const [ids, setIds] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const isIds = audienceChoice === "ids";
  const audience = isIds ? `ids:${ids.trim()}` : audienceChoice;

  const subjectInvalid = touched && subject.trim().length === 0;
  const bodyInvalid = touched && body.trim().length === 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setResult(null);

    const parsed = broadcastSchema.safeParse({
      audience,
      subject: subject.trim(),
      body: body.trim(),
      marketing,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Please check the form.";
      setResult({ kind: "error", message: first });
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setResult({ kind: "error", message: data?.error ?? "Could not send the broadcast." });
        return;
      }
      const data = (await res.json()) as { recipientCount: number };
      setResult({ kind: "ok", count: data.recipientCount });
      setSubject("");
      setBody("");
      setIds("");
      setMarketing(false);
      setTouched(false);
    } catch {
      setResult({ kind: "error", message: "Network error. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bc-audience">Audience</Label>
        <select
          id="bc-audience"
          value={audienceChoice}
          onChange={(e) => setAudienceChoice(e.target.value)}
          className={inputClass}
        >
          {AUDIENCE_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {isIds ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Input
              id="bc-ids"
              value={ids}
              onChange={(e) => setIds(e.target.value)}
              placeholder="user-id-1, user-id-2, …"
              className="h-9 bg-background/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Comma-separated user IDs. Sends only to these users.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bc-subject">Subject</Label>
        <Input
          id="bc-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          aria-invalid={subjectInvalid}
          placeholder="e.g. Publishing temporarily degraded"
          className="h-9 bg-background/60"
        />
        <div className="flex items-center justify-between">
          {subjectInvalid ? (
            <p className="text-[11px] text-status-failed">A subject is required.</p>
          ) : (
            <span />
          )}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {subject.length}/200
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bc-body">Body</Label>
        <textarea
          id="bc-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={5000}
          aria-invalid={bodyInvalid}
          placeholder="Write the message customers will receive…"
          className={inputClass}
        />
        <div className="flex items-center justify-between">
          {bodyInvalid ? (
            <p className="text-[11px] text-status-failed">A body is required.</p>
          ) : (
            <span />
          )}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {body.length}/5000
          </span>
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-input bg-background/40 px-3 py-2.5">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Send as marketing newsletter</span>
          <span className="text-[11px] text-muted-foreground">
            Only sends to users who haven&apos;t opted out, and adds a one-click unsubscribe link.
            Leave off for operational notices (service status, price changes).
          </span>
        </span>
      </label>

      {result ? (
        <p
          role="status"
          className={
            result.kind === "ok"
              ? "text-xs text-status-posted"
              : "text-xs text-status-failed"
          }
        >
          {result.kind === "ok"
            ? `Sent to ${result.count} recipient${result.count === 1 ? "" : "s"}.`
            : result.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {pending ? "Sending…" : "Send broadcast"}
        </Button>
      </div>
    </form>
  );
}

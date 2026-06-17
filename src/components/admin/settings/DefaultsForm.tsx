"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, RotateCcw, Save } from "lucide-react";
import type { EditableDefaults } from "@/server/settings/config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Editable platform defaults for the admin settings page (doc 20). Controlled form mirroring
// defaultsUpdateSchema (trialDays / refundWindowDays integers 0–90; signupsDefault boolean).
// PATCHes /api/admin/settings/defaults, router.refresh()es the RSC, and shows "Saved ✓" /
// inline error. Mirrors AnnouncementForm. The server is the real validation gate.

const inputClass =
  "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function clamp090(value: string): { num: number; invalid: boolean } {
  const num = Number.parseInt(value, 10);
  return { num, invalid: !Number.isInteger(num) || num < 0 || num > 90 };
}

export function DefaultsForm({ initial }: { initial: EditableDefaults }) {
  const router = useRouter();
  const [trialDays, setTrialDays] = useState(String(initial.trialDays));
  const [refundWindowDays, setRefundWindowDays] = useState(String(initial.refundWindowDays));
  const [signupsDefault, setSignupsDefault] = useState(initial.signupsDefault);

  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trial = clamp090(trialDays);
  const refund = clamp090(refundWindowDays);
  const hasError = trial.invalid || refund.invalid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasError) return;
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const res = await fetch("/api/admin/settings/defaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDays: trial.num,
          refundWindowDays: refund.num,
          signupsDefault,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not save the defaults.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        These were previously code constants. Edits take effect within seconds - no deploy
        required.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default-trial" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Trial length (days)
          </Label>
          <input
            id="default-trial"
            type="number"
            inputMode="numeric"
            min="0"
            max="90"
            step="1"
            value={trialDays}
            onChange={(e) => {
              setTrialDays(e.target.value);
              setSaved(false);
            }}
            aria-invalid={touched && trial.invalid}
            className={inputClass}
          />
          {touched && trial.invalid ? (
            <p className="text-[11px] text-status-failed">Whole number between 0 and 90.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default-refund" className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Refund window (days)
          </Label>
          <input
            id="default-refund"
            type="number"
            inputMode="numeric"
            min="0"
            max="90"
            step="1"
            value={refundWindowDays}
            onChange={(e) => {
              setRefundWindowDays(e.target.value);
              setSaved(false);
            }}
            aria-invalid={touched && refund.invalid}
            className={inputClass}
          />
          {touched && refund.invalid ? (
            <p className="text-[11px] text-status-failed">Whole number between 0 and 90.</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-foreground/[0.02] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="default-signups" className="text-sm font-medium">
            Sign-ups allowed by default
          </Label>
          <p className="text-xs text-muted-foreground">
            The fallback for new sign-ups when the kill switch is unset.
          </p>
        </div>
        <Switch
          id="default-signups"
          checked={signupsDefault}
          onCheckedChange={(next) => {
            setSignupsDefault(next);
            setSaved(false);
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-status-posted">Saved ✓</span> : null}
        {error ? <span className="text-xs text-status-failed">{error}</span> : null}
        <Button type="submit" size="sm" disabled={pending || (touched && hasError)}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save defaults
        </Button>
      </div>
    </form>
  );
}

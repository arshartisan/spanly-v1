"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save } from "lucide-react";
import type { PlanAdminRow } from "@/server/admin/plans";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Create / edit form for a plan tier (admin plan catalog). A popover-hosted controlled form
// mirroring the Zod contract in `@/lib/schemas/admin-plans` (planCreateSchema /
// planUpdateSchema) so the UX matches server validation — but the server is the real gate.
// On submit it POSTs (create) or PATCHes (edit) the admin plans API, then router.refresh()es
// the RSC. `accountLimit` uses the -1 ⇄ "Unlimited" sentinel: an "Unlimited" checkbox sets the
// stored value to -1 and disables the number input. Mirrors AnnouncementForm / UserActions.

const inputClass =
  "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const KEY_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** The editable subset of a plan, as the form holds it (accountLimit as -1 = unlimited). */
interface PlanFormValues {
  key: string;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  accountLimit: number; // -1 = unlimited
  features: string[];
  rank: number;
  isPublic: boolean;
  active: boolean;
}

function valuesFromRow(row: PlanAdminRow): PlanFormValues {
  return {
    key: row.key,
    name: row.name,
    tagline: row.tagline,
    monthly: row.monthly,
    yearly: row.yearly,
    accountLimit: row.accountLimit,
    features: row.features,
    rank: row.rank,
    isPublic: row.isPublic,
    active: row.active,
  };
}

export function PlanForm({
  mode,
  plan,
  nextRank = 0,
}: {
  mode: "create" | "edit";
  /** The existing row (edit mode). Omitted in create mode. */
  plan?: PlanAdminRow;
  /** Suggested rank for a new plan (create mode) — one past the current max. */
  nextRank?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            New plan
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-h-[80vh] overflow-y-auto">
        <PlanFormBody
          mode={mode}
          plan={plan}
          nextRank={nextRank}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function PlanFormBody({
  mode,
  plan,
  nextRank,
  onDone,
}: {
  mode: "create" | "edit";
  plan?: PlanAdminRow;
  nextRank: number;
  onDone: () => void;
}) {
  const router = useRouter();

  const initial: PlanFormValues =
    mode === "edit" && plan
      ? valuesFromRow(plan)
      : {
          key: "",
          name: "",
          tagline: "",
          monthly: 0,
          yearly: 0,
          accountLimit: 15,
          features: [],
          rank: nextRank,
          isPublic: true,
          active: true,
        };

  const [key, setKey] = useState(initial.key);
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [monthly, setMonthly] = useState(String(initial.monthly));
  const [yearly, setYearly] = useState(String(initial.yearly));
  const unlimitedInitial = initial.accountLimit < 0;
  const [unlimited, setUnlimited] = useState(unlimitedInitial);
  const [accountLimit, setAccountLimit] = useState(
    unlimitedInitial ? "0" : String(initial.accountLimit),
  );
  const [featuresText, setFeaturesText] = useState(initial.features.join("\n"));
  const [rank, setRank] = useState(String(initial.rank));
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [active, setActive] = useState(initial.active);

  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Client-side validation mirroring the Zod schema (server is the real gate). ──
  const keyTrim = key.trim();
  const keyInvalid =
    mode === "create" &&
    (keyTrim.length === 0 || keyTrim.length > 32 || !KEY_RE.test(keyTrim));
  const nameInvalid = name.trim().length === 0 || name.trim().length > 60;
  const monthlyNum = Number.parseInt(monthly, 10);
  const yearlyNum = Number.parseInt(yearly, 10);
  const limitNum = Number.parseInt(accountLimit, 10);
  const rankNum = Number.parseInt(rank, 10);
  const monthlyInvalid = !Number.isInteger(monthlyNum) || monthlyNum < 0;
  const yearlyInvalid = !Number.isInteger(yearlyNum) || yearlyNum < 0;
  const limitInvalid = !unlimited && (!Number.isInteger(limitNum) || limitNum < 0);
  const rankInvalid = !Number.isInteger(rankNum) || rankNum < 0;

  const features = featuresText
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const hasError =
    keyInvalid || nameInvalid || monthlyInvalid || yearlyInvalid || limitInvalid || rankInvalid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasError) return;
    setError(null);
    setPending(true);

    const effectiveLimit = unlimited ? -1 : limitNum;
    const body = {
      name: name.trim(),
      tagline: tagline.trim(),
      monthly: monthlyNum,
      yearly: yearlyNum,
      accountLimit: effectiveLimit,
      features,
      rank: rankNum,
      isPublic,
      active,
    };

    try {
      const res =
        mode === "create"
          ? await fetch("/api/admin/plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: keyTrim, ...body }),
            })
          : await fetch(`/api/admin/plans/${encodeURIComponent(plan!.key)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error ??
            (mode === "create" ? "Could not create the plan." : "Could not save changes."),
        );
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-medium">{mode === "create" ? "New plan" : "Edit plan"}</p>

      {/* Key — create-only (immutable); shown read-only in edit mode. */}
      {mode === "create" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-key">Key</Label>
          <input
            id="plan-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            maxLength={32}
            placeholder="e.g. growth"
            aria-invalid={touched && keyInvalid}
            className={`${inputClass} font-mono`}
            autoFocus
          />
          {touched && keyInvalid ? (
            <p className="text-[11px] text-status-failed">
              A lowercase slug (letters, numbers, hyphens), 1–32 chars.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Key</Label>
          <p className="rounded-lg border border-border/50 bg-foreground/[0.03] px-3 py-2 font-mono text-sm text-muted-foreground">
            {plan!.key}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-name">Name</Label>
        <input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          aria-invalid={touched && nameInvalid}
          className={inputClass}
        />
        {touched && nameInvalid ? (
          <p className="text-[11px] text-status-failed">A name is required (1–60 chars).</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-tagline">Tagline</Label>
        <input
          id="plan-tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
          placeholder="e.g. Best for growing creators"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-monthly">Monthly ($)</Label>
          <input
            id="plan-monthly"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            aria-invalid={touched && monthlyInvalid}
            className={inputClass}
          />
          {touched && monthlyInvalid ? (
            <p className="text-[11px] text-status-failed">Whole number ≥ 0.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-yearly">Yearly ($)</Label>
          <input
            id="plan-yearly"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
            aria-invalid={touched && yearlyInvalid}
            className={inputClass}
          />
          {touched && yearlyInvalid ? (
            <p className="text-[11px] text-status-failed">Whole number ≥ 0.</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-limit">Account limit</Label>
        <input
          id="plan-limit"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={accountLimit}
          onChange={(e) => setAccountLimit(e.target.value)}
          disabled={unlimited}
          aria-invalid={touched && limitInvalid}
          className={inputClass}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={unlimited} onCheckedChange={setUnlimited} id="plan-unlimited" />
          <span>Unlimited (stored as -1)</span>
        </label>
        {touched && limitInvalid ? (
          <p className="text-[11px] text-status-failed">Whole number ≥ 0, or check Unlimited.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-features">Features (one per line)</Label>
        <textarea
          id="plan-features"
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={4}
          placeholder={"Unlimited posts\nSchedule & queue\nAnalytics"}
          className={inputClass}
        />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {features.length} feature{features.length === 1 ? "" : "s"} · max 20
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-rank">Rank (tier order, 0 = lowest)</Label>
        <input
          id="plan-rank"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          aria-invalid={touched && rankInvalid}
          className={inputClass}
        />
        {touched && rankInvalid ? (
          <p className="text-[11px] text-status-failed">Whole number ≥ 0.</p>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Public (shown on pricing)</span>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} id="plan-public" />
      </label>

      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Active (enforced in catalog)</span>
        <Switch checked={active} onCheckedChange={setActive} id="plan-active" />
      </label>

      {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || (touched && hasError)}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : mode === "create" ? (
            <Plus className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {mode === "create" ? "Create plan" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

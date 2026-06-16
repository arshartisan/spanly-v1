"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { BillingInterval, PlanKey, SubscriptionStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLANS } from "@/server/plans";
import { STATUS_LABEL } from "@/components/admin/users/display";
import { cn } from "@/lib/utils";

// Superadmin-only billing controls for the user Subscription tab (doc 17). Two popover
// forms: override the subscription (plan/interval/status/trial) and grant account credit.
// Both POST to the admin API and router.refresh() the RSC on success.

const PLAN_KEYS = Object.values(PlanKey);
const STATUSES = Object.values(SubscriptionStatus);
const INTERVALS = Object.values(BillingInterval);
const KEEP = "__keep__";

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Monthly",
  year: "Yearly",
};

type Feedback = { kind: "ok" | "error"; message: string } | null;

export function SubscriptionOverride({ userId }: { userId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl border border-primary/20 p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Superadmin billing controls</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Manual overrides write directly to the subscription. Use deliberately — every change
        is recorded in the audit log.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <OverridePopover userId={userId} onFeedback={setFeedback} onSuccess={() => router.refresh()} />
        <CreditPopover userId={userId} onFeedback={setFeedback} onSuccess={() => router.refresh()} />
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

function OverridePopover({
  userId,
  onFeedback,
  onSuccess,
}: {
  userId: string;
  onFeedback: (f: Feedback) => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState<string>(KEEP);
  const [interval, setInterval] = useState<string>(KEEP);
  const [status, setStatus] = useState<string>(KEEP);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = {};
    if (plan !== KEEP) body.plan = plan;
    if (interval !== KEEP) body.interval = interval;
    if (status !== KEEP) body.status = status;
    if (trialEndsAt) {
      // <input type="date"> gives YYYY-MM-DD; send an ISO datetime the schema accepts.
      body.trialEndsAt = new Date(`${trialEndsAt}T00:00:00.000Z`).toISOString();
    }
    if (Object.keys(body).length === 0) {
      setError("Change at least one field.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not override subscription.");
        return;
      }
      onFeedback({ kind: "ok", message: "Subscription overridden." });
      setPlan(KEEP);
      setInterval(KEEP);
      setStatus(KEEP);
      setTrialEndsAt("");
      setOpen(false);
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Override subscription
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm font-medium">Override subscription</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-plan">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger id="override-plan" aria-label="Plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {PLAN_KEYS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLANS[p].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-interval">Interval</Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger id="override-interval" aria-label="Interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {INTERVAL_LABEL[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="override-status" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-trial">Trial ends (optional)</Label>
            <Input
              id="override-trial"
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="h-9 bg-background/60"
            />
          </div>
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function CreditPopover({
  userId,
  onFeedback,
  onSuccess,
}: {
  userId: string;
  onFeedback: (f: Feedback) => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dollars = Number.parseFloat(amount);
  const validAmount = Number.isFinite(dollars) && dollars > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!validAmount || !reason.trim()) return;
    setError(null);

    const cents = Math.round(dollars * 100);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cents, reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not grant credit.");
        return;
      }
      onFeedback({ kind: "ok", message: "Credit granted." });
      setAmount("");
      setReason("");
      setTouched(false);
      setOpen(false);
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Coins className="h-3.5 w-3.5" />
          Grant credit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm font-medium">Grant account credit</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-amount">Amount (USD)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="credit-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                aria-invalid={touched && !validAmount}
                className="h-9 bg-background/60 pl-7"
                autoFocus
              />
            </div>
            {touched && !validAmount ? (
              <p className="text-[11px] text-status-failed">Enter an amount greater than zero.</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-reason">Reason</Label>
            <Input
              id="credit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              placeholder="e.g. Goodwill for outage"
              aria-invalid={touched && !reason.trim()}
              className="h-9 bg-background/60"
            />
            {touched && !reason.trim() ? (
              <p className="text-[11px] text-status-failed">A reason is required.</p>
            ) : null}
          </div>
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !validAmount || !reason.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Grant
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

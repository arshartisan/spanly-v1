"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIST } from "@/server/plans";
import { cn } from "@/lib/utils";
import type { BillingInterval, PlanKey, SubscriptionStatus } from "@prisma/client";

// Plans tab (doc 10). Monthly/Yearly toggle, three plan cards, current plan marked, checkout CTA.
export function PlansPanel({
  currentPlan,
  currentInterval,
  status,
  overLimit,
  accountLimit,
  activeAccounts,
}: {
  currentPlan: PlanKey | null;
  currentInterval: BillingInterval;
  status: SubscriptionStatus | null;
  overLimit: boolean;
  accountLimit: number | null;
  activeAccounts: number;
}) {
  const params = useSearchParams();
  const initialInterval: BillingInterval = params.get("interval") === "year" ? "year" : currentInterval;
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanKey) {
    setBusy(plan);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) {
      window.location.href = data.url;
    } else {
      setBusy(null);
      setError(data?.error ?? "Could not start checkout.");
    }
  }

  const activeSub = currentPlan && status && status !== "canceled";

  return (
    <div className="flex flex-col gap-5">
      {overLimit && accountLimit !== null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have {activeAccounts} connected accounts but your plan allows {accountLimit}. Existing
          accounts keep working, but you can't connect new ones until you upgrade or disconnect some.
        </div>
      )}

      {/* Interval toggle */}
      <div className="flex items-center justify-center gap-1 rounded-lg border bg-background p-1 self-center">
        {(["month", "year"] as BillingInterval[]).map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setInterval(iv)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              interval === iv ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {iv === "month" ? "Monthly" : "Yearly"}
            {iv === "year" && <span className="ml-1 text-xs opacity-80">save ~2mo</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_LIST.map((plan) => {
          const isCurrent = activeSub && currentPlan === plan.key && currentInterval === interval;
          const price = interval === "year" ? plan.yearly : plan.monthly;
          const per = interval === "year" ? "/yr" : "/mo";
          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col rounded-xl border bg-background p-5",
                isCurrent && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="mt-3 text-2xl font-bold">
                ${price}
                <span className="text-sm font-normal text-muted-foreground">{per}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.accountLimit === Infinity ? "Unlimited" : plan.accountLimit} connected accounts
              </p>

              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5"
                variant={isCurrent ? "outline" : "default"}
                disabled={!!isCurrent || busy !== null}
                onClick={() => checkout(plan.key)}
              >
                {busy === plan.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCurrent ? "Current plan" : activeSub ? "Change plan" : "Get started"}
              </Button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">7-day money-back guarantee.</p>
    </div>
  );
}

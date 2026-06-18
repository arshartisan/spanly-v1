"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_PLAN_DEFS } from "@/lib/plan-defaults";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const PLANS = DEFAULT_PLAN_DEFS.filter((p) => p.isPublic && p.active).sort(
  (a, b) => a.rank - b.rank,
);
const POPULAR = "growth"; // highlighted tier

function accountLabel(limit: number) {
  return limit === Infinity ? "Unlimited accounts" : `${limit} connected accounts`;
}

// Dark pricing block driven by the real plan catalog (DEFAULT_PLAN_DEFS). Monthly/annual
// toggle; sharp bordered cards; the Growth tier is highlighted in orange.
export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className={cn("bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]", SECTION_X)} id="pricing">
      <div className="mx-auto max-w-7xl py-20 md:py-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <MonoLabel className="text-[hsl(22_92%_52%)]">Pricing</MonoLabel>
            <h2 className="mt-4 max-w-xl text-3xl leading-tight tracking-tight sm:text-4xl">
              Simple plans that scale with your accounts.
            </h2>
          </div>

          {/* Billing toggle */}
          <div className="inline-flex overflow-hidden rounded-[6px] border border-white/15 font-mono text-xs uppercase tracking-[0.14em]">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "px-4 py-2 transition-colors",
                !annual ? "bg-[hsl(22_92%_52%)] text-[hsl(20_30%_8%)]" : "text-[hsl(30_10%_70%)]",
              )}
              aria-pressed={!annual}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "px-4 py-2 transition-colors",
                annual ? "bg-[hsl(22_92%_52%)] text-[hsl(20_30%_8%)]" : "text-[hsl(30_10%_70%)]",
              )}
              aria-pressed={annual}
            >
              Annual
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {PLANS.map((plan) => {
            const popular = plan.key === POPULAR;
            const price = annual ? Math.round(plan.yearly / 12) : plan.monthly;
            return (
              <div
                key={plan.key}
                className={cn(
                  "flex h-full flex-col p-8",
                  popular ? "bg-[hsl(24_40%_12%)]" : "bg-[hsl(20_14%_5%)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <MonoLabel className="text-[hsl(30_25%_96%)]">{plan.name}</MonoLabel>
                  {popular && (
                    <span className="bg-[hsl(22_92%_52%)] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(20_30%_8%)]">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[hsl(30_10%_70%)]">{plan.tagline}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-5xl tracking-tight">${price}</span>
                  <span className="text-sm text-[hsl(30_10%_55%)]">/mo</span>
                </div>
                <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[hsl(30_10%_55%)]">
                  {annual ? `$${plan.yearly} billed yearly` : "billed monthly"}
                </p>

                <p className="mt-5 text-sm font-medium text-[hsl(22_92%_52%)]">
                  {accountLabel(plan.accountLimit)}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[hsl(30_10%_80%)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(22_92%_52%)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={cn(
                    "mt-8 rounded-[6px]",
                    !popular &&
                      "border border-white/25 bg-transparent text-[hsl(30_25%_96%)] hover:bg-white/10",
                  )}
                  variant={popular ? "default" : "ghost"}
                >
                  <Link href="/signup">Start free trial</Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[hsl(30_10%_55%)]">
          7-day free trial · 7-day money-back guarantee · API access available as a $5/mo add-on
        </p>
      </div>
    </section>
  );
}

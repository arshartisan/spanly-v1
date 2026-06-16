import { Check, Infinity as InfinityIcon, Lock } from "lucide-react";
import { PLAN_LIST, type PlanDef } from "@/server/plans";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

// Admin plan catalog (doc 17) — read-only RSC. Renders PLAN_LIST as cards; pricing/limits
// are enforced from server config (an editable catalog is a planned enhancement).

export const dynamic = "force-dynamic";

export default function AdminPlansPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="text-sm text-muted-foreground">
          The subscription catalog enforced across the platform.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="glass flex items-start gap-3 rounded-2xl border border-border/50 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Plan catalog is read-only here; pricing and limits are enforced from server
            config. An editable catalog is a planned enhancement.
          </p>
        </div>
      </Reveal>

      <Stagger className="grid gap-4 md:grid-cols-3" delayChildren={0.12}>
        {PLAN_LIST.map((plan) => (
          <StaggerItem key={plan.key} className="h-full">
            <PlanCard plan={plan} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanDef }) {
  const unlimited = plan.accountLimit === Infinity;

  return (
    <Card className="flex h-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{plan.name}</h2>
          <span className="inline-flex items-center rounded-full bg-status-posted/10 px-2 py-0.5 text-[11px] font-medium text-status-posted ring-1 ring-inset ring-status-posted/20">
            Enforced
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-foreground/[0.02] p-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold tabular-nums">${plan.monthly}</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        <div className="text-sm text-muted-foreground">
          or <span className="font-medium text-foreground">${plan.yearly}</span> / year
        </div>
        <div className="flex items-center gap-1.5 border-t border-border/50 pt-3 text-sm">
          <span className="text-muted-foreground">Connected accounts:</span>
          {unlimited ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <InfinityIcon className="h-4 w-4" />
              Unlimited
            </span>
          ) : (
            <span className="font-medium text-foreground tabular-nums">{plan.accountLimit}</span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-posted" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PLANS } from "@/server/plans";
import { Button } from "@/components/ui/button";
import type { BillingInterval, PlanKey } from "@prisma/client";

/**
 * Internal mock Stripe Checkout (docs/implementation/10, D-014). Stands in for the real Stripe
 * Checkout so the subscribe → 7-day trial flow works with no Stripe account. "Subscribe" hits
 * /api/billing/mock/complete which performs the same Subscription upsert the webhook would.
 * Rendered outside the (app) shell to feel like an external page.
 */
export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const { plan, interval } = await searchParams;
  if (!plan || !(plan in PLANS) || (interval !== "month" && interval !== "year")) notFound();

  const key = plan as PlanKey;
  const def = PLANS[key];
  const iv = interval as BillingInterval;
  const price = iv === "year" ? def.yearly : def.monthly;
  const per = iv === "year" ? "/year" : "/month";

  const subscribeHref = `/api/billing/mock/complete?plan=${key}&interval=${iv}`;
  const cancelHref = "/settings/plans?canceled=1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Mock Checkout</p>
        <h1 className="mb-4 text-lg font-semibold leading-tight">Subscribe to {def.name}</h1>

        <div className="mb-4 rounded-lg border bg-background p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{def.name}</span>
            <span className="text-lg font-semibold">
              ${price}
              <span className="text-sm font-normal text-muted-foreground">{per}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">7-day free trial · $0 due today</p>
        </div>

        <p className="mb-5 text-xs text-muted-foreground">
          Development stand-in for Stripe Checkout. No card is charged. Your trial ends in 7 days;
          cancel anytime from the billing portal.
        </p>

        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <Link href={subscribeHref}>Start 7-day trial</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

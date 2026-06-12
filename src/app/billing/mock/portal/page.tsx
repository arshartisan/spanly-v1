import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { PLANS, planLabel } from "@/server/plans";
import { Button } from "@/components/ui/button";

/**
 * Internal mock Stripe Billing Portal (docs/implementation/10, D-014). Stands in for the real
 * customer portal. "Cancel subscription" hits /api/billing/mock/cancel → status canceled.
 */
export default async function MockPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sub = user.subscription;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Mock Billing Portal</p>
        <h1 className="mb-4 text-lg font-semibold leading-tight">Manage subscription</h1>

        {sub ? (
          <div className="mb-4 rounded-lg border bg-background p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{planLabel(sub.plan, sub.status)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">
                ${sub.interval === "year" ? PLANS[sub.plan].yearly : PLANS[sub.plan].monthly}
                /{sub.interval === "year" ? "yr" : "mo"}
              </span>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">No active subscription.</p>
        )}

        <p className="mb-5 text-xs text-muted-foreground">
          Development stand-in for the Stripe customer portal (manage card, invoices, cancel).
        </p>

        <div className="flex flex-col gap-2">
          {sub && sub.status !== "canceled" && (
            <Button asChild variant="outline" className="w-full text-destructive hover:text-destructive">
              <Link href="/api/billing/mock/cancel">Cancel subscription</Link>
            </Button>
          )}
          <Button asChild className="w-full">
            <Link href="/settings/billing">Back to billing</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, planLabel } from "@/server/plans";
import type { BillingInterval, PlanKey, SubscriptionStatus } from "@prisma/client";

interface SubView {
  plan: PlanKey;
  interval: BillingInterval;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  apiAddonActive: boolean;
}

// Billing tab (doc 10). Live subscription state + Stripe actions (mock-backed in dev, D-014).
export function BillingPanel({
  mode,
  subscription,
  activeAccounts,
}: {
  mode: "mock" | "live";
  subscription: SubView | null;
  activeAccounts: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [addonBusy, setAddonBusy] = useState(false);
  const [addon, setAddon] = useState(subscription?.apiAddonActive ?? false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [refundMsg, setRefundMsg] = useState<string | null>(null);

  async function openPortal() {
    setPortalBusy(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) window.location.href = data.url;
    else setPortalBusy(false);
  }

  async function toggleAddon() {
    setAddonBusy(true);
    const next = !addon;
    const res = await fetch("/api/billing/addons/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enable: next }),
    });
    setAddonBusy(false);
    if (res.ok) {
      setAddon(next);
      router.refresh();
    }
  }

  async function requestRefund() {
    setRefundMsg(null);
    const res = await fetch("/api/billing/refund", { method: "POST" });
    const data = await res.json().catch(() => null);
    setRefundMsg(data?.message ?? "Request submitted.");
  }

  if (!subscription) {
    return (
      <div className="flex flex-col gap-4">
        {mode === "mock" && <MockNotice />}
        <div className="rounded-xl border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">You don't have an active subscription.</p>
          <Button asChild className="mt-3">
            <Link href="/settings/plans">Choose a plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  const def = PLANS[subscription.plan];
  const price = subscription.interval === "year" ? def.yearly : def.monthly;
  const per = subscription.interval === "year" ? "/year" : "/month";
  const isTrial = subscription.status === "trialing";
  const isCanceled = subscription.status === "canceled";

  return (
    <div className="flex flex-col gap-4">
      {mode === "mock" && <MockNotice />}
      {params.get("subscribed") === "1" && (
        <Banner tone="success">Subscribed — your 7-day trial has started.</Banner>
      )}
      {params.get("canceled") === "1" && <Banner tone="muted">Your subscription was canceled.</Banner>}

      {subscription.interval === "month" && !isCanceled && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">
            Save ~2 months with annual billing — <span className="font-medium">${def.yearly}/yr</span>.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/plans?interval=year">Upgrade to Annual</Link>
          </Button>
        </div>
      )}

      {/* Current plan */}
      <section className="rounded-xl border bg-background p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{def.name}</h2>
              {isTrial && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Trial
                </span>
              )}
              {isCanceled && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Canceled
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              ${price}
              {per} · {planLabel(subscription.plan)}
            </p>
            {isTrial && subscription.trialEndsAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Trial ends {formatDate(subscription.trialEndsAt)}
              </p>
            )}
            {!isTrial && subscription.currentPeriodEnd && !isCanceled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Renews {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {activeAccounts} of {def.accountLimit === Infinity ? "∞" : def.accountLimit} accounts used
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/plans">Change Plan</Link>
          </Button>
          {!isCanceled && (
            <Button variant="outline" size="sm" disabled={portalBusy} onClick={openPortal}>
              Pause / Cancel
            </Button>
          )}
        </div>
      </section>

      {/* API add-on */}
      <section className="flex items-center justify-between rounded-xl border bg-background p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">API Access</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                addon ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {addon ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">API add-on — $5/mo.</p>
        </div>
        <Button variant="outline" size="sm" disabled={addonBusy || isCanceled} onClick={toggleAddon}>
          {addonBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {addon ? "Disable Add-on" : "Enable Add-on"}
        </Button>
      </section>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <button
          type="button"
          onClick={openPortal}
          disabled={portalBusy}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
        >
          {portalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
          Billing Portal
        </button>
        <button
          type="button"
          onClick={requestRefund}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Request Refund
        </button>
        {refundMsg && <span className="text-xs text-foreground">{refundMsg}</span>}
      </div>
    </div>
  );
}

function MockNotice() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Billing is in <span className="font-medium">mock mode</span> — checkout and the portal use
      internal stand-ins (no Stripe account or card needed). Set <code>BILLING_MODE=live</code> +
      Stripe keys to switch on real payments.
    </div>
  );
}

function Banner({ tone, children }: { tone: "success" | "muted"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        tone === "success" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

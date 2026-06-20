import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { readSettings, getQueue } from "@/server/settings";
import { activeAccountCount } from "@/server/connections";
import { accountLimit, isOverAccountLimit, getPlanCatalog, getPlanMap } from "@/server/plans";
import { BILLING_MODE, appUrl } from "@/server/billing-config";
import { reconcileSubscription } from "@/server/billing";
import { SettingsTabs, type SettingsTab } from "@/components/settings/SettingsTabs";
import { GeneralPanel } from "@/components/settings/GeneralPanel";
import { QueuePanel } from "@/components/settings/QueuePanel";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { PlansPanel } from "@/components/settings/PlansPanel";

const TABS: SettingsTab[] = ["general", "queue", "billing", "plans"];

// Settings (doc 11): one page, four route-backed tabs. Each tab loads only what it needs.
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await params;
  if (!TABS.includes(tab as SettingsTab)) notFound();
  const active = tab as SettingsTab;

  let user = await getCurrentUser();
  if (!user) redirect("/login");

  // On return from Polar checkout (?subscribed=1 / ?addon=1 with the checkout_id Polar
  // substitutes into the success URL), reconcile straight from Polar so the billing tab reflects
  // the new plan/add-on immediately rather than waiting for the async webhook. Then re-read the
  // user so the panel renders the fresh subscription. Failures fall back to the webhook backstop.
  const sp = await searchParams;
  if (
    active === "billing" &&
    (sp.subscribed === "1" || sp.addon === "1") &&
    typeof sp.checkout_id === "string"
  ) {
    await reconcileSubscription(sp.checkout_id, user.id).catch(() => {});
    user = (await getCurrentUser()) ?? user;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsTabs active={active} />

      {active === "general" && (
        <GeneralPanel
          initial={{
            displayName: user.displayName ?? "",
            email: user.email,
            avatarUrl: user.avatarUrl,
            timezone: user.timezone,
            emailVerified: !!user.emailVerified,
            marketingEmails: user.marketingEmails,
            settings: readSettings(user.settings),
          }}
          mcpEndpoint={appUrl("/api/mcp")}
        />
      )}

      {active === "queue" && <QueuePanel initial={await getQueue(user.id, user.timezone)} />}

      {active === "billing" && (
        <BillingPanel
          mode={BILLING_MODE}
          subscription={
            user.subscription
              ? {
                  plan: user.subscription.plan,
                  interval: user.subscription.interval,
                  status: user.subscription.status,
                  trialEndsAt: user.subscription.trialEndsAt?.toISOString() ?? null,
                  currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString() ?? null,
                  cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
                  apiAddonActive: user.subscription.apiAddonActive,
                }
              : null
          }
          activeAccounts={await activeAccountCount(user.id)}
          plan={
            user.subscription
              ? (await getPlanMap())[user.subscription.plan] ?? undefined
              : undefined
          }
        />
      )}

      {active === "plans" && (
        <PlansPanel
          currentPlan={user.subscription?.plan ?? null}
          currentInterval={user.subscription?.interval ?? "month"}
          status={user.subscription?.status ?? null}
          activeAccounts={await activeAccountCount(user.id)}
          overLimit={
            user.subscription
              ? isOverAccountLimit(user.subscription.plan, await activeAccountCount(user.id))
              : false
          }
          accountLimit={user.subscription ? accountLimit(user.subscription.plan) : null}
          plans={await getPlanCatalog()}
        />
      )}
    </div>
  );
}

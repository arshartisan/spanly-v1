import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { readSettings, getQueue } from "@/server/settings";
import { activeAccountCount } from "@/server/connections";
import { accountLimit, isOverAccountLimit } from "@/server/plans";
import { BILLING_MODE, appUrl } from "@/server/stripe";
import { SettingsTabs, type SettingsTab } from "@/components/settings/SettingsTabs";
import { GeneralPanel } from "@/components/settings/GeneralPanel";
import { QueuePanel } from "@/components/settings/QueuePanel";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { PlansPanel } from "@/components/settings/PlansPanel";

const TABS: SettingsTab[] = ["general", "queue", "billing", "plans"];

// Settings (doc 11): one page, four route-backed tabs. Each tab loads only what it needs.
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!TABS.includes(tab as SettingsTab)) notFound();
  const active = tab as SettingsTab;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
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
                  apiAddonActive: user.subscription.apiAddonActive,
                }
              : null
          }
          activeAccounts={await activeAccountCount(user.id)}
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
        />
      )}
    </div>
  );
}

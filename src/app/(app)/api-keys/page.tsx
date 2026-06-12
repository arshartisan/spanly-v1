import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { listApiKeys, requireApiAddon } from "@/server/api-keys";
import { getWebhook } from "@/server/webhooks";
import { ApiKeysView } from "@/components/api-keys/ApiKeysView";

// API Keys (design doc 12). Programmatic access + post-completion webhook, gated behind the
// paid API add-on. The gate is enforced server-side on every key/webhook action too.
export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const addonActive = requireApiAddon(user.subscription).ok;
  const keys = addonActive ? await listApiKeys(user.id) : [];
  const webhook = addonActive ? await getWebhook(user.id) : null;

  return <ApiKeysView addonActive={addonActive} initialKeys={keys} initialWebhook={webhook} />;
}

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { accountLimit } from "@/server/plans";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { ConnectionsView, type ConnectionsNotice } from "@/components/connections/ConnectionsView";
import type { AccountVM } from "@/components/connections/AccountChip";

// /connections (docs/implementation/05). Lists live accounts (disconnectedAt:null) for the
// 6 platforms and enforces the plan account-limit server-side via the connect routes.
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null; // layout guards/redirects

  const rows = await prisma.socialAccount.findMany({
    where: { userId: user.id, disconnectedAt: null },
    orderBy: { connectedAt: "asc" },
  });

  const accounts: AccountVM[] = rows.map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle.startsWith("@") ? a.handle : `@${a.handle}`,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    externalId: a.externalId,
    status: a.status,
  }));

  const plan = user.subscription?.plan ?? "creator";
  const limit = accountLimit(plan);

  const { connected, error } = await searchParams;
  const notice = buildNotice(connected, error);

  return (
    <ConnectionsView
      accounts={accounts}
      used={accounts.length}
      limit={Number.isFinite(limit) ? limit : null}
      notice={notice}
    />
  );
}

function buildNotice(connected?: string, error?: string): ConnectionsNotice | null {
  if (connected && PLATFORM_CONFIG[connected as PlatformKey]) {
    return { type: "success", text: `${PLATFORM_CONFIG[connected as PlatformKey].label} connected.` };
  }
  switch (error) {
    case "limit":
      return {
        type: "error",
        text: "You've reached your plan's account limit. Upgrade to connect more accounts.",
      };
    case "cancelled":
      return { type: "error", text: "Connection cancelled." };
    case "state":
      return { type: "error", text: "That connection link expired. Please try connecting again." };
    case "callback":
      return { type: "error", text: "We couldn't complete the connection. Please try again." };
    case "unknown":
      return { type: "error", text: "Unknown platform." };
    default:
      return null;
  }
}

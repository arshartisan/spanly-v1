import Link from "next/link";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import { listConnections, type AdminConnectionListItem } from "@/server/admin/content";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { connectionListQuerySchema } from "@/lib/schemas/admin-content";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { ConnectionFilters } from "@/components/admin/content/ConnectionFilters";
import { ForceDisconnect } from "@/components/admin/content/ForceDisconnect";
import { AccountStatusBadge, PlatformChip } from "@/components/admin/content/display";
import { cn } from "@/lib/utils";

// Admin cross-user connections list (doc 18) — RSC. Parses the URL query with the shared Zod
// schema, reads via listConnections(), and renders the subscriptions-style glass table.
// Filters live in the client <ConnectionFilters/>. Admins get a force-disconnect action per
// live account. Tokens are never selected or rendered.

export const dynamic = "force-dynamic";

const EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireStaff();
  const canModerate = roleAtLeast(viewer.role, "admin");
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = connectionListQuerySchema.safeParse({
    platform: first(raw.platform),
    status: first(raw.status),
    tokenHealth: first(raw.tokenHealth),
  });
  const filter = parsed.success ? parsed.data : {};

  const accounts = await listConnections(filter);
  const now = Date.now();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Every connected social account across all users.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <ConnectionFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {accounts.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>User</Th>
                    <Th>Platform</Th>
                    <Th>Handle</Th>
                    <Th>Status</Th>
                    <Th>Connected</Th>
                    <Th>Token expiry</Th>
                    {canModerate ? <Th className="text-right">Actions</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <ConnectionRow
                      key={a.id}
                      account={a}
                      canModerate={canModerate}
                      now={now}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>
    </div>
  );
}

function ConnectionRow({
  account,
  canModerate,
  now,
}: {
  account: AdminConnectionListItem;
  canModerate: boolean;
  now: number;
}) {
  const disconnected = account.disconnectedAt !== null;
  const pendingTargets = account._count.targets;

  return (
    <tr
      className={cn(
        "group border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]",
        disconnected && "opacity-60",
      )}
    >
      <Td>
        <Link
          href={`/admin/users/${account.user.id}`}
          className="flex min-w-0 flex-col focus-visible:outline-none"
        >
          <span className="truncate font-medium text-foreground group-hover:underline">
            {account.user.email}
          </span>
          {account.user.displayName ? (
            <span className="truncate text-xs text-muted-foreground">
              {account.user.displayName}
            </span>
          ) : null}
        </Link>
      </Td>
      <Td>
        <PlatformChip platform={account.platform} />
      </Td>
      <Td>
        <span className={cn("font-medium", disconnected && "line-through")}>
          {account.handle}
        </span>
        {account.displayName ? (
          <span className="block truncate text-xs text-muted-foreground">
            {account.displayName}
          </span>
        ) : null}
      </Td>
      <Td>
        {disconnected ? (
          <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/60">
            Disconnected
          </span>
        ) : (
          <AccountStatusBadge status={account.status} />
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {format(new Date(account.connectedAt), "d MMM yyyy")}
      </Td>
      <Td className="whitespace-nowrap">
        <TokenExpiry expiresAt={account.tokenExpiresAt} now={now} />
      </Td>
      {canModerate ? (
        <Td className="text-right">
          {disconnected ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <ForceDisconnect
              accountId={account.id}
              handle={account.handle}
              pendingTargets={pendingTargets}
            />
          )}
        </Td>
      ) : null}
    </tr>
  );
}

function TokenExpiry({ expiresAt, now }: { expiresAt: Date | null; now: number }) {
  if (!expiresAt) {
    return <span className="text-xs text-muted-foreground">No expiry</span>;
  }
  const ts = new Date(expiresAt).getTime();
  const expired = ts < now;
  const expiringSoon = !expired && ts <= now + EXPIRING_WINDOW_MS;
  return (
    <span
      className={cn(
        "text-sm",
        expired
          ? "font-medium text-status-failed"
          : expiringSoon
            ? "font-medium text-status-draft"
            : "text-muted-foreground",
      )}
    >
      {format(new Date(expiresAt), "d MMM yyyy, HH:mm")}
      {expired ? " (expired)" : expiringSoon ? " (≤24h)" : ""}
    </span>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Plug className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No connections match</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a different filter, or clear them to widen the results.
          </p>
        </div>
      </div>
    </Card>
  );
}

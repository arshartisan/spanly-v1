import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Users } from "lucide-react";
import { listUsers, type AdminUserListItem } from "@/server/admin/users";
import { userListQuerySchema } from "@/lib/schemas/admin-users";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { UserFilters } from "@/components/admin/users/UserFilters";
import {
  PlanBadge,
  RoleBadge,
  SuspendedPill,
  VerifiedPill,
} from "@/components/admin/users/display";

// Admin user list (doc 16) — RSC. Parses the URL query with the shared Zod schema,
// reads via listUsers(), and renders a glass table with the same warm-dark styling as
// the rest of the admin surface. Filters live in the client <UserFilters/>; pagination
// is a plain "Load more" link that appends the returned cursor.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = userListQuerySchema.safeParse({
    query: first(raw.query),
    role: first(raw.role),
    plan: first(raw.plan),
    status: first(raw.status),
    suspended: first(raw.suspended),
    verified: first(raw.verified),
    cursor: first(raw.cursor),
    take: first(raw.take),
  });
  const filter = parsed.success ? parsed.data : userListQuerySchema.parse({});

  const { users, nextCursor } = await listUsers(filter);

  // Build the "Load more" href by carrying the current filters forward + new cursor.
  const loadMoreParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== "cursor") loadMoreParams.set(key, v);
  }
  if (nextCursor) loadMoreParams.set("cursor", nextCursor);
  const loadMoreHref = `/admin/users?${loadMoreParams.toString()}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Find any account and run standard support actions.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <UserFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {users.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Plan</Th>
                    <Th className="text-right">Accounts</Th>
                    <Th className="text-right">Posts</Th>
                    <Th>Created</Th>
                    <Th>Status</Th>
                    <Th className="sr-only">Open</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>

      {nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={loadMoreHref}
            className="press glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Load more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function UserRow({ user }: { user: AdminUserListItem }) {
  const verified = user.emailVerified !== null;
  const suspended = user.suspendedAt !== null;
  const initial = (user.displayName ?? user.email).charAt(0).toUpperCase();

  return (
    <tr className="group border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td>
        <Link
          href={`/admin/users/${user.id}`}
          className="flex items-center gap-3 focus-visible:outline-none"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground group-hover:underline">
              {user.email}
            </span>
            {user.displayName ? (
              <span className="truncate text-xs text-muted-foreground">{user.displayName}</span>
            ) : null}
          </span>
        </Link>
      </Td>
      <Td>
        <RoleBadge role={user.role} />
      </Td>
      <Td>
        <PlanBadge plan={user.subscription?.plan} status={user.subscription?.status} />
      </Td>
      <Td className="text-right tabular-nums">{user._count.accounts}</Td>
      <Td className="text-right tabular-nums">{user._count.posts}</Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {formatDistanceToNow(user.createdAt, { addSuffix: true })}
      </Td>
      <Td>
        <div className="flex flex-wrap items-center gap-1.5">
          {suspended ? <SuspendedPill /> : null}
          <VerifiedPill verified={verified} />
        </div>
      </Td>
      <Td className="text-right">
        <Link
          href={`/admin/users/${user.id}`}
          aria-label={`Open ${user.email}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Td>
    </tr>
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
          <Users className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No users match</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a different search term or clear the filters to widen the results.
          </p>
        </div>
      </div>
    </Card>
  );
}

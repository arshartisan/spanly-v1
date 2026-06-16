import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Ban } from "lucide-react";
import { getUserDetail } from "@/server/admin/users";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reveal } from "@/components/motion/reveal";
import { UserActions } from "@/components/admin/users/UserActions";
import { UserDetailTabs } from "@/components/admin/users/UserDetailTabs";
import { SupportPowers } from "@/components/admin/users/SupportPowers";
import { PlanBadge, RoleBadge } from "@/components/admin/users/display";

// Admin user detail (doc 16) — RSC. Reads the full user via getUserDetail() and hands the
// already-fetched data to the client tab + action components (no client refetch). 404s on a
// missing id.

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireStaff();
  const canManageBilling = roleAtLeast(viewer.role, "superadmin");
  const isSuperadmin = roleAtLeast(viewer.role, "superadmin");
  const user = await getUserDetail(id);
  if (!user) notFound();

  const targetIsStaff = roleAtLeast(user.role, "support");

  const suspended = user.suspendedAt !== null;
  const verified = user.emailVerified !== null;
  const initial = (user.displayName ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="glass flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-lg">{initial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">
                  {user.displayName ?? user.email}
                </h1>
                {user.displayName ? (
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} />
                  <PlanBadge plan={user.subscription?.plan} status={user.subscription?.status} />
                  {!verified ? (
                    <span className="inline-flex items-center rounded-full bg-status-draft/10 px-2 py-0.5 text-[11px] font-medium text-status-draft ring-1 ring-inset ring-status-draft/20">
                      Unverified
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {suspended ? (
            <div className="flex items-center gap-2 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-2.5 text-sm text-status-failed">
              <Ban className="h-4 w-4 shrink-0" />
              <span>
                Suspended on {format(new Date(user.suspendedAt!), "d MMM yyyy, HH:mm")}. Sign-in and
                new publishes are blocked.
              </span>
            </div>
          ) : null}

          <UserActions
            user={{
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              suspended,
              verified,
            }}
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <UserDetailTabs user={user} canManageBilling={canManageBilling} />
      </Reveal>

      {isSuperadmin ? (
        <Reveal delay={0.14}>
          <SupportPowers
            user={{ id: user.id, email: user.email }}
            targetIsStaff={targetIsStaff}
          />
        </Reveal>
      ) : null}
    </div>
  );
}

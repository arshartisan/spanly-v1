"use client";

import { useId, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  CreditCard,
  FileText,
  Link2,
  MonitorSmartphone,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import type { AdminUserDetail } from "@/server/admin/users";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import type { PlatformKey } from "@/lib/platforms";
import { STATUS_META, TYPE_LABEL, snippet } from "@/lib/post-display";
import { cn } from "@/lib/utils";
import { PlanBadge, ROLE_LABEL, STATUS_LABEL } from "./display";
import { SupportNotes, type SupportNoteVM } from "./SupportNotes";
import { SubscriptionOverride, type PlanOption } from "@/components/admin/billing/SubscriptionOverride";

// Tabbed detail panels for an admin user (doc 16). Accessible custom tab switcher (no
// shadcn Tabs primitive): role="tablist"/"tab"/"tabpanel" + aria-selected, arrow-key
// roving focus. All data arrives pre-fetched from the RSC as props - never refetched here.

type TabKey = "profile" | "subscription" | "connections" | "posts" | "sessions" | "activity";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "connections", label: "Connections", icon: Link2 },
  { key: "posts", label: "Posts", icon: FileText },
  { key: "sessions", label: "Sessions", icon: MonitorSmartphone },
  { key: "activity", label: "Activity & notes", icon: Activity },
];

export function UserDetailTabs({
  user,
  canManageBilling = false,
  planOptions,
}: {
  user: AdminUserDetail;
  canManageBilling?: boolean;
  /** Live catalog plan options for the override select; falls back to statics when omitted. */
  planOptions?: PlanOption[];
}) {
  const [active, setActive] = useState<TabKey>("profile");
  const baseId = useId();

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.findIndex((t) => t.key === active);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive(TABS[(idx + 1) % TABS.length].key);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(TABS[(idx - 1 + TABS.length) % TABS.length].key);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(TABS[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(TABS[TABS.length - 1].key);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="User details"
        onKeyDown={onKeyDown}
        className="glass flex flex-wrap gap-1 rounded-2xl p-1"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.key)}
              className={cn(
                "press inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary/15 font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {active === "profile" ? <ProfilePanel user={user} /> : null}
        {active === "subscription" ? (
          <SubscriptionPanel
            sub={user.subscription}
            userId={user.id}
            canManageBilling={canManageBilling}
            planOptions={planOptions}
          />
        ) : null}
        {active === "connections" ? <ConnectionsPanel accounts={user.accounts} /> : null}
        {active === "posts" ? <PostsPanel posts={user.posts} /> : null}
        {active === "sessions" ? <SessionsPanel sessions={user.sessions} /> : null}
        {active === "activity" ? (
          <ActivityPanel
            userId={user.id}
            auditLogs={user.auditLogs}
            notes={user.supportNotes as SupportNoteVM[]}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────── Shared bits ───────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("glass rounded-2xl p-5", className)}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground/90">{children}</dd>
    </div>
  );
}

function EmptyPanel({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <Panel className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Panel>
  );
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return format(new Date(d), "d MMM yyyy, HH:mm");
}

// ─────────────────────────── Profile ───────────────────────────

function ProfilePanel({ user }: { user: AdminUserDetail }) {
  return (
    <Panel>
      <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="User id">
          <span className="font-mono text-xs">{user.id}</span>
        </Field>
        <Field label="Email">{user.email}</Field>
        <Field label="Display name">{user.displayName ?? "-"}</Field>
        <Field label="Role">{ROLE_LABEL[user.role]}</Field>
        <Field label="Timezone">{user.timezone}</Field>
        <Field label="Email verified">
          {user.emailVerified ? fmtDate(user.emailVerified) : "Not verified"}
        </Field>
        <Field label="Suspended">
          {user.suspendedAt ? fmtDate(user.suspendedAt) : "No"}
        </Field>
        <Field label="Created">{fmtDate(user.createdAt)}</Field>
        <Field label="Last updated">{fmtDate(user.updatedAt)}</Field>
      </dl>
    </Panel>
  );
}

// ─────────────────────────── Subscription ───────────────────────────

function SubscriptionPanel({
  sub,
  userId,
  canManageBilling,
  planOptions,
}: {
  sub: AdminUserDetail["subscription"];
  userId: string;
  canManageBilling: boolean;
  planOptions?: PlanOption[];
}) {
  if (!sub) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyPanel icon={CreditCard} message="No subscription on this account." />
        {canManageBilling ? (
          <SubscriptionOverride userId={userId} planOptions={planOptions} />
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PlanBadge plan={sub.plan} status={sub.status} />
        {sub.apiAddonActive ? (
          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/25">
            API add-on
          </span>
        ) : null}
      </div>
      <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="Billing interval">{sub.interval === "year" ? "Yearly" : "Monthly"}</Field>
        <Field label="Status">{STATUS_LABEL[sub.status]}</Field>
        <Field label="Trial ends">{fmtDate(sub.trialEndsAt)}</Field>
        <Field label="Current period end">{fmtDate(sub.currentPeriodEnd)}</Field>
        <Field label="API add-on">{sub.apiAddonActive ? "Active" : "Off"}</Field>
        <Field label="PayPal payer">
          {sub.providerCustomerId ? (
            <span className="font-mono text-xs">{sub.providerCustomerId}</span>
          ) : (
            "-"
          )}
        </Field>
        <Field label="PayPal subscription">
          {sub.providerSubId ? (
            <span className="font-mono text-xs">{sub.providerSubId}</span>
          ) : (
            "-"
          )}
        </Field>
      </dl>
    </Panel>
      {canManageBilling ? (
        <SubscriptionOverride userId={userId} planOptions={planOptions} />
      ) : null}
    </div>
  );
}

// ─────────────────────────── Connections ───────────────────────────

function ConnectionsPanel({ accounts }: { accounts: AdminUserDetail["accounts"] }) {
  if (accounts.length === 0) {
    return <EmptyPanel icon={Link2} message="No connected accounts." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {accounts.map((account) => {
        const style = PLATFORM_STYLE[account.platform as PlatformKey];
        const Icon = style.Icon;
        const disconnected = account.disconnectedAt !== null;
        return (
          <Panel key={account.id} className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: style.color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{style.label}</span>
                <AccountStatusPill status={account.status} disconnected={disconnected} />
              </div>
              <span className="truncate text-sm text-muted-foreground">{account.handle}</span>
              <span className="text-xs text-muted-foreground">
                Token expires: {fmtDate(account.tokenExpiresAt)}
              </span>
              {disconnected ? (
                <span className="text-xs text-status-failed">
                  Disconnected {fmtDate(account.disconnectedAt)}
                </span>
              ) : null}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function AccountStatusPill({
  status,
  disconnected,
}: {
  status: string;
  disconnected: boolean;
}) {
  const tone = disconnected
    ? "bg-foreground/5 text-muted-foreground ring-border/60"
    : status === "active"
      ? "bg-status-posted/10 text-status-posted ring-status-posted/20"
      : status === "expired"
        ? "bg-status-draft/10 text-status-draft ring-status-draft/20"
        : "bg-status-failed/10 text-status-failed ring-status-failed/20";
  const label = disconnected ? "Disconnected" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tone,
      )}
    >
      {label}
    </span>
  );
}

// ─────────────────────────── Posts ───────────────────────────

function PostsPanel({ posts }: { posts: AdminUserDetail["posts"] }) {
  if (posts.length === 0) {
    return <EmptyPanel icon={FileText} message="No posts yet." />;
  }
  return (
    <Panel className="p-0">
      <ul className="divide-y divide-border/40">
        {posts.map((post) => {
          const meta = STATUS_META[post.status];
          const when = post.publishedAt ?? post.publishAt ?? post.createdAt;
          return (
            <li key={post.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  meta.badge,
                )}
              >
                {meta.label}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm text-foreground/90">
                  {post.mainCaption ? snippet(post.mainCaption, 120) : (
                    <span className="text-muted-foreground">No caption</span>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">
                  {TYPE_LABEL[post.type]} · {fmtDate(when)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ─────────────────────────── Sessions ───────────────────────────

function SessionsPanel({ sessions }: { sessions: AdminUserDetail["sessions"] }) {
  const now = Date.now();
  const activeCount = sessions.filter((s) => new Date(s.expires).getTime() > now).length;

  if (sessions.length === 0) {
    return <EmptyPanel icon={MonitorSmartphone} message="No sessions on record." />;
  }
  return (
    <Panel className="p-0">
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3 text-sm">
        <span className="font-medium">
          {activeCount} active session{activeCount === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-muted-foreground">{sessions.length} total</span>
      </div>
      <ul className="divide-y divide-border/40">
        {sessions.map((session) => {
          const expired = new Date(session.expires).getTime() <= now;
          return (
            <li key={session.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{session.id}</span>
              <span className={cn("text-xs", expired ? "text-status-failed" : "text-muted-foreground")}>
                {expired ? "Expired" : "Expires"} {fmtDate(session.expires)}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ─────────────────────────── Activity & notes ───────────────────────────

function ActivityPanel({
  userId,
  auditLogs,
  notes,
}: {
  userId: string;
  auditLogs: AdminUserDetail["auditLogs"];
  notes: SupportNoteVM[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Audit log
        </h3>
        {auditLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-8 text-center">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No recorded activity.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-0.5 rounded-xl border border-border/50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-foreground/90">
                    {log.action}
                  </span>
                  <span
                    className="text-[11px] text-muted-foreground"
                    title={fmtDate(log.createdAt)}
                  >
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Actor: <span className="font-mono">{log.actorId}</span>
                  {log.ip ? ` · ${log.ip}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Support notes
        </h3>
        <SupportNotes userId={userId} notes={notes} />
      </Panel>
    </div>
  );
}

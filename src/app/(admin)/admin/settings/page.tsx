import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Megaphone,
  Power,
  Settings2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { KNOWN_FLAGS, listFlags } from "@/server/settings/flags";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { getEditableDefaults } from "@/server/settings/config";
import { getPlanCatalog } from "@/server/plans";
import { PLATFORMS, PLATFORM_CONFIG } from "@/lib/platforms";
import type { PlanDef } from "@/lib/plan-defaults";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FlagToggle } from "@/components/admin/settings/FlagToggle";
import { DefaultsForm } from "@/components/admin/settings/DefaultsForm";

// Admin Platform Settings - feature flags / kill switches + read-only defaults (doc 20). RSC.
// View is gated at `admin`; the global kill switches (signups, publishing, maintenance-mode)
// are superadmin-only - those toggles are disabled for non-superadmins with a hint, and the
// API enforces the same rule. Mirrors the /admin/system page structure.

export const dynamic = "force-dynamic";

// The three global kill switches; superadmin-only to change.
const GLOBAL_KEYS = new Set(["signups", "publishing", "maintenance-mode"]);

interface FlagRow {
  key: string;
  description: string;
  enabled: boolean;
  isGlobal: boolean;
}

// Pretty label for a flag key, e.g. "platform.tiktok" → "TikTok", "content-studio" →
// "Content studio", "api" → "API".
const SPECIAL_LABELS: Record<string, string> = {
  signups: "Sign-ups",
  publishing: "Publishing",
  "content-studio": "Content studio",
  bulk: "Bulk tools",
  api: "Public API",
  "maintenance-mode": "Maintenance mode",
};

function humanizeFlag(key: string): string {
  if (key.startsWith("platform.")) {
    const p = key.slice("platform.".length);
    return (PLATFORM_CONFIG as Record<string, { label?: string }>)[p]?.label ?? p;
  }
  return SPECIAL_LABELS[key] ?? key;
}

export default async function AdminSettingsPage() {
  const viewer = await requireStaff("admin");
  const canToggleGlobal = roleAtLeast(viewer.role, "superadmin");

  const [stored, defaults, catalog] = await Promise.all([
    listFlags(),
    getEditableDefaults(),
    getPlanCatalog(),
  ]);
  const storedByKey = new Map(stored.map((f) => [f.key, f.enabled]));

  // Merge KNOWN_FLAGS (canonical list, incl. unseeded keys) with stored rows. Unseeded keys
  // default to enabled, except maintenance-mode which defaults to off.
  const rows: FlagRow[] = KNOWN_FLAGS.map((f) => {
    const storedEnabled = storedByKey.get(f.key);
    const enabled =
      storedEnabled !== undefined ? storedEnabled : f.key !== "maintenance-mode";
    return { key: f.key, description: f.description, enabled, isGlobal: GLOBAL_KEYS.has(f.key) };
  });

  const byKey = (k: string): FlagRow | undefined => rows.find((r) => r.key === k);

  const globalRows = ["signups", "publishing", "maintenance-mode"]
    .map(byKey)
    .filter((r): r is FlagRow => r !== undefined);
  const platformRows = PLATFORMS.map((p) => byKey(`platform.${p}`)).filter(
    (r): r is FlagRow => r !== undefined,
  );
  const featureRows = ["content-studio", "bulk", "api"]
    .map(byKey)
    .filter((r): r is FlagRow => r !== undefined);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Feature flags, kill switches, and customer-facing announcements. Changes take effect
          within seconds - no deploy required.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="flex flex-wrap gap-2">
          <TabLink href="/admin/settings/announcements" icon={Megaphone} label="Announcements" />
        </div>
      </Reveal>

      {!canToggleGlobal ? (
        <Reveal delay={0.08}>
          <div className="flex items-center gap-2 rounded-xl border border-status-draft/30 bg-status-draft/10 px-4 py-2.5 text-xs text-status-draft">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            You can change platform &amp; feature flags. The global kill switches (sign-ups,
            publishing, maintenance mode) are superadmin-only.
          </div>
        </Reveal>
      ) : null}

      {/* ── Global kill switches ── */}
      <Reveal delay={0.1}>
        <SectionTitle icon={Power}>Kill switches · global</SectionTitle>
      </Reveal>
      <Reveal delay={0.12}>
        <FlagGroup
          rows={globalRows}
          canToggleGlobal={canToggleGlobal}
          emphasizeMaintenance
        />
      </Reveal>

      {/* ── Platforms ── */}
      <Reveal delay={0.16}>
        <SectionTitle icon={Layers}>Platforms</SectionTitle>
      </Reveal>
      <Reveal delay={0.18}>
        <FlagGroup rows={platformRows} canToggleGlobal={canToggleGlobal} />
      </Reveal>

      {/* ── Features ── */}
      <Reveal delay={0.22}>
        <SectionTitle icon={Sparkles}>Features</SectionTitle>
      </Reveal>
      <Reveal delay={0.24}>
        <FlagGroup rows={featureRows} canToggleGlobal={canToggleGlobal} />
      </Reveal>

      {/* ── Defaults (editable, DB-backed) ── */}
      <Reveal delay={0.28}>
        <SectionTitle icon={Settings2}>Defaults</SectionTitle>
      </Reveal>
      <Reveal delay={0.3}>
        <DefaultsPanel defaults={defaults} catalog={catalog} />
      </Reveal>
    </div>
  );
}

function FlagGroup({
  rows,
  canToggleGlobal,
  emphasizeMaintenance = false,
}: {
  rows: FlagRow[];
  canToggleGlobal: boolean;
  emphasizeMaintenance?: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <Stagger className="flex flex-col" delayChildren={0.03}>
        {rows.map((row) => {
          const disabled = row.isGlobal && !canToggleGlobal;
          const isMaintenance = row.key === "maintenance-mode";
          return (
            <StaggerItem key={row.key}>
              <div className="flex items-center justify-between gap-4 border-b border-border/40 px-4 py-3.5 last:border-0">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`flag-${row.key}`}
                      className="text-sm font-medium"
                    >
                      {humanizeFlag(row.key)}
                    </label>
                    {emphasizeMaintenance && isMaintenance ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-failed/10 px-2 py-0.5 text-[10px] font-medium text-status-failed ring-1 ring-inset ring-status-failed/20">
                        <ShieldAlert className="h-3 w-3" />
                        Affects customers
                      </span>
                    ) : row.isGlobal ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/20">
                        Global
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <FlagToggle
                  flagKey={row.key}
                  enabled={row.enabled}
                  disabled={disabled}
                  disabledHint={disabled ? "Superadmin only" : undefined}
                  labelId={`flag-${row.key}`}
                />
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Card>
  );
}

function DefaultsPanel({
  defaults,
  catalog,
}: {
  defaults: { trialDays: number; refundWindowDays: number; signupsDefault: boolean };
  catalog: PlanDef[];
}) {
  return (
    <Card className="p-5">
      <DefaultsForm initial={defaults} />

      <div className="mt-6 border-t border-border/50 pt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plan account limits
        </h3>
        <p className="mb-3 text-[11px] text-muted-foreground">
          The live catalog (edit on the{" "}
          <Link href="/admin/plans" className="text-primary hover:underline">
            Plans
          </Link>{" "}
          page).
        </p>
        <div className="overflow-hidden rounded-xl border border-border/50">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Monthly</th>
                <th className="px-4 py-2.5 text-right font-medium">Account limit</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((plan) => (
                <tr
                  key={plan.key}
                  className="border-b border-border/30 last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{plan.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    ${plan.monthly}/mo
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {Number.isFinite(plan.accountLimit) ? plan.accountLimit : "Unlimited"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function TabLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="press glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
    </Link>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-4 w-4" />
      {children}
    </h2>
  );
}

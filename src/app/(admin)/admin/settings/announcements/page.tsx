import Link from "next/link";
import { format } from "date-fns";
import type { Announcement } from "@prisma/client";
import { ArrowLeft, Megaphone } from "lucide-react";
import { listAnnouncements } from "@/server/settings/flags";
import { requireStaff } from "@/server/admin/access";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { AnnouncementForm } from "@/components/admin/settings/AnnouncementForm";
import { AnnouncementActions } from "@/components/admin/settings/AnnouncementActions";

// Admin Announcements - create + manage customer-facing banners (doc 20). RSC, view = admin.
// Mirrors the /admin/system page structure. The create form + per-row activate/delete are
// client components that PATCH/POST/DELETE and router.refresh().

export const dynamic = "force-dynamic";

const SEVERITY_BADGE: Record<string, string> = {
  info: "bg-status-scheduled/10 text-status-scheduled ring-1 ring-inset ring-status-scheduled/20",
  warning: "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20",
  critical: "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20",
};

function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function audienceLabel(audience: string): string {
  if (audience === "all") return "Everyone";
  if (audience === "trialing") return "Trialing";
  if (audience.startsWith("plan:")) {
    const p = audience.slice("plan:".length);
    return `${p.charAt(0).toUpperCase() + p.slice(1)} plan`;
  }
  return audience;
}

function windowLabel(a: Announcement): string {
  const fmt = (d: Date) => format(new Date(d), "d MMM yyyy, HH:mm");
  if (a.startsAt && a.endsAt) return `${fmt(a.startsAt)} → ${fmt(a.endsAt)}`;
  if (a.startsAt) return `From ${fmt(a.startsAt)}`;
  if (a.endsAt) return `Until ${fmt(a.endsAt)}`;
  return "Open-ended";
}

export default async function AdminAnnouncementsPage() {
  await requireStaff("admin");
  const announcements = await listAnnouncements();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>
      </Reveal>

      <Reveal delay={0.04}>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Customer-facing banners shown in the app, filtered by audience and active window.
        </p>
      </Reveal>

      {/* ── Create ── */}
      <Reveal delay={0.08}>
        <SectionTitle>New announcement</SectionTitle>
      </Reveal>
      <Reveal delay={0.1}>
        <Card className="p-5">
          <AnnouncementForm />
        </Card>
      </Reveal>

      {/* ── Existing ── */}
      <Reveal delay={0.14}>
        <SectionTitle>All announcements</SectionTitle>
      </Reveal>
      <Reveal delay={0.16}>
        {announcements.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          SEVERITY_BADGE[a.severity] ?? SEVERITY_BADGE.info,
                        )}
                      >
                        {severityLabel(a.severity)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/70 ring-1 ring-inset ring-border/60">
                        {audienceLabel(a.audience)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{windowLabel(a)}</span>
                    </div>
                    <p className="max-w-2xl text-sm text-foreground/90">{a.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Created {format(new Date(a.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <AnnouncementActions id={a.id} active={a.active} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Reveal>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">No announcements yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create one above to show a banner to customers in the app.
          </p>
        </div>
      </div>
    </Card>
  );
}

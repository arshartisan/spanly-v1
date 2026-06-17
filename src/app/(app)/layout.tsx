import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getSessionContext } from "@/server/auth";
import { planLabel } from "@/server/plans";
import { roleAtLeast } from "@/server/admin/access";
import { activeAnnouncements, isEnabled } from "@/server/settings/flags";
import { Sidebar } from "@/components/shell/Sidebar";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { ImpersonationBanner } from "@/components/shell/ImpersonationBanner";
import {
  AnnouncementBanner,
  type BannerAnnouncement,
} from "@/components/shell/AnnouncementBanner";

// Authenticated shell (doc 04). Server component: full DB session validation here
// (middleware only checked cookie presence). Wraps every /(app)/* page. Also surfaces the
// platform-settings banners (doc 20): active customer announcements + a maintenance-mode
// notice. Staff are never blocked — the maintenance banner is informational only here;
// read-only enforcement of mutations is out of scope for this UI task (banner only).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  // No valid session. If a (now-invalid) session cookie is still present, middleware lets
  // protected routes through on cookie *presence* alone, then bounces /login back here on the
  // same cookie — an infinite 307 loop. Route through the logout endpoint, which clears the
  // stale cookie server-side, so /login is reached cookie-free and renders normally.
  if (!ctx) redirect("/api/auth/logout");
  const { user, impersonatorId } = ctx;

  const label = user.subscription
    ? planLabel(user.subscription.plan, user.subscription.status)
    : "No plan";

  const isStaff = roleAtLeast(user.role, "support");

  // Audience + window filtering happens server-side in activeAnnouncements().
  const [announcements, maintenance] = await Promise.all([
    activeAnnouncements(user),
    isEnabled("maintenance-mode"),
  ]);

  const banners: BannerAnnouncement[] = announcements.map((a) => ({
    id: a.id,
    message: a.message,
    severity: a.severity,
  }));

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      <Sidebar
        user={{
          displayName: user.displayName ?? user.email,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        planLabel={label}
        isStaff={isStaff}
      />
      <SmoothScroll>
        {impersonatorId || maintenance || banners.length > 0 ? (
          <div className="flex flex-col gap-2 px-4 pt-4 md:px-8">
            {impersonatorId ? <ImpersonationBanner email={user.email} /> : null}
            {maintenance ? (
              <div
                role="status"
                className="glass flex items-start gap-3 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-2.5 text-sm text-status-failed"
              >
                <Wrench className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p className="leading-snug">
                  Spanlyfy is in maintenance mode. Some actions may be temporarily unavailable —
                  thanks for your patience.
                </p>
              </div>
            ) : null}
            {banners.length > 0 ? <AnnouncementBanner announcements={banners} /> : null}
          </div>
        ) : null}
        {children}
      </SmoothScroll>
    </div>
  );
}

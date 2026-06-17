"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Dismissible customer-facing announcement banners (doc 20). The (app) layout fetches
// activeAnnouncements(user) (already audience + window filtered server-side) and passes the
// id/message/severity here. Dismissal is remembered per-id in localStorage so it stays
// dismissed across reloads until a new announcement appears.

export interface BannerAnnouncement {
  id: string;
  message: string;
  severity: string;
}

const STORAGE_PREFIX = "spanly:announcement-dismissed:";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-status-scheduled/30 bg-status-scheduled/10 text-status-scheduled",
  warning: "border-status-draft/30 bg-status-draft/10 text-status-draft",
  critical: "border-status-failed/30 bg-status-failed/10 text-status-failed",
};

function severityIcon(severity: string) {
  if (severity === "critical") return ShieldAlert;
  if (severity === "warning") return AlertTriangle;
  return Info;
}

export function AnnouncementBanner({ announcements }: { announcements: BannerAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = new Set<string>();
    for (const a of announcements) {
      try {
        if (localStorage.getItem(STORAGE_PREFIX + a.id) === "1") next.add(a.id);
      } catch {
        // localStorage unavailable (private mode) - show the banner.
      }
    }
    setDismissed(next);
    setHydrated(true);
  }, [announcements]);

  function dismiss(id: string) {
    try {
      localStorage.setItem(STORAGE_PREFIX + id, "1");
    } catch {
      // ignore persistence failures; still hide for this session.
    }
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Avoid a hydration flash: render nothing until we've read localStorage.
  if (!hydrated) return null;

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((a) => {
        const Icon = severityIcon(a.severity);
        return (
          <div
            key={a.id}
            role="status"
            className={cn(
              "glass flex items-start gap-3 rounded-xl border px-4 py-2.5 text-sm",
              SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1 leading-snug">{a.message}</p>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss announcement"
              className="-mr-1 shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

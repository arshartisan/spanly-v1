"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { COOKIE_CATEGORIES } from "@/lib/cookie-content";
import { ALL_GRANTED, NECESSARY_ONLY, type ConsentState } from "@/lib/consent";

// Granular consent controls. Opened from the banner's "Customize" or any "Manage cookies"
// link. Strictly necessary is shown locked-on; optional categories are real toggles that
// start from the user's current choice. Focus is trapped lightly (focus the panel, Escape
// closes) for keyboard + screen-reader users.
export function CookiePreferencesDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: ConsentState;
  onClose: () => void;
  onSave: (state: ConsentState) => void;
}) {
  const [analytics, setAnalytics] = useState(initial.analytics);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="cookie-prefs-title" className="text-lg font-semibold text-foreground">
              Cookie preferences
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which cookies Spanlyfy may use. Read more in our{" "}
              <Link href="/cookies" className="underline underline-offset-4 hover:text-primary">
                Cookie Policy
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie preferences"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col divide-y divide-border/60">
          {COOKIE_CATEGORIES.map((cat) => {
            const isAnalytics = cat.key === "analytics";
            return (
              <div key={cat.key} className="flex items-start justify-between gap-4 py-4 first:pt-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{cat.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
                <div className="pt-0.5">
                  {cat.required ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      Always on
                    </span>
                  ) : (
                    <Switch
                      id={`consent-${cat.key}`}
                      checked={isAnalytics ? analytics : false}
                      onCheckedChange={isAnalytics ? setAnalytics : () => {}}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onSave(NECESSARY_ONLY)}
            className="sm:order-1 sm:mr-auto"
          >
            Reject non-essential
          </Button>
          <Button
            variant="outline"
            onClick={() => onSave({ necessary: true, analytics })}
            className="sm:order-2"
          >
            Save preferences
          </Button>
          <Button onClick={() => onSave(ALL_GRANTED)} className="sm:order-3">
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}

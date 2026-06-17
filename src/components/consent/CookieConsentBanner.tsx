"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent } from "./ConsentProvider";

// First-visit consent banner. Anchored bottom-centre, above all content. PECR/GDPR require
// that rejecting is as easy as accepting, so "Accept all" and "Reject non-essential" carry
// equal visual weight (same size, same row); "Customize" opens granular controls. Nothing
// non-essential runs until a choice is made here.
export function CookieConsentBanner() {
  const { acceptAll, rejectAll, openPreferences } = useConsent();

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:p-6"
    >
      <div className="glass w-full max-w-2xl rounded-2xl p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Cookie className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">We value your privacy</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We use strictly necessary cookies to keep you signed in and the Service secure.
              With your consent we also use analytics cookies to understand and improve how
              Spanlyfy is used. You can accept, reject, or choose per category - and change your
              mind anytime. See our{" "}
              <Link href="/cookies" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {/* Equal prominence: accept and reject are the same size, side by side. */}
              <Button onClick={acceptAll} className="sm:flex-1">
                Accept all
              </Button>
              <Button variant="outline" onClick={rejectAll} className="sm:flex-1">
                Reject non-essential
              </Button>
              <Button variant="ghost" onClick={openPreferences} className="sm:w-auto">
                Customize
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useConsent } from "./ConsentProvider";

/**
 * Gated slot for product analytics. Mounted once at the root; renders nothing until the
 * user has granted the "analytics" category, so no analytics SDK or cookie loads without
 * consent. This is the single drop-in point — there is no analytics provider wired up yet.
 *
 * To add one (e.g. Plausible, GA4, PostHog) later, load it here, only in the granted branch:
 *
 *   import Script from "next/script";
 *   ...
 *   if (!consent.analytics) return null;
 *   return (
 *     <Script
 *       defer
 *       data-domain="spanly.app"
 *       src="https://plausible.io/js/script.js"
 *       strategy="afterInteractive"
 *     />
 *   );
 *
 * Because this reads live consent, withdrawing analytics consent unmounts the script on the
 * next render. For SDKs that set cookies, also clear them in an effect on the !granted branch.
 */
export function AnalyticsScripts() {
  const { ready, consent } = useConsent();
  if (!ready || !consent.analytics) return null;

  // No analytics provider configured yet — see the JSDoc above for the integration pattern.
  return null;
}

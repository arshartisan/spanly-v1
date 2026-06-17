/**
 * Cookie inventory + Cookie Policy content. One typed source of truth shared by the
 * Cookie Policy page and the preferences dialog, so the categories we disclose and the
 * categories we let users toggle can never drift apart.
 *
 * Keep COOKIES honest: list only what the app actually sets. When you add a new cookie or
 * an analytics provider, add its row here AND bump CONSENT_VERSION in lib/consent.ts so
 * returning users are re-prompted.
 */

import type { OptionalCategory } from "@/lib/consent";
import { LEGAL } from "@/lib/legal-content";

export interface CookieCategoryMeta {
  /** Stable key. "necessary" is always-on; optional keys map to consent toggles. */
  key: "necessary" | OptionalCategory;
  title: string;
  /** Whether the category can be switched off (false → always active). */
  required: boolean;
  description: string;
}

export interface CookieRow {
  name: string;
  provider: string;
  category: CookieCategoryMeta["key"];
  purpose: string;
  /** Human-readable lifetime. */
  duration: string;
}

export const COOKIE_CATEGORIES: CookieCategoryMeta[] = [
  {
    key: "necessary",
    title: "Strictly necessary",
    required: true,
    description:
      "Required for the Service to work: they keep you signed in, secure your session, and remember interface preferences such as your theme. They never identify you for advertising, and the Service cannot function without them, so they cannot be switched off.",
  },
  {
    key: "analytics",
    title: "Analytics",
    required: false,
    description:
      "Help us understand how Spanlyfy is used — which features are used and where people run into trouble — so we can improve it. This data is aggregated and used only to operate and improve the Service; we do not use it for advertising or sell it. These are off until you turn them on.",
  },
];

/**
 * The cookies we actually set today. Spanlyfy currently uses only strictly necessary
 * cookies — there are no analytics or advertising cookies in production yet. The analytics
 * category and toggle exist so that consent is in place the moment such cookies are added.
 */
export const COOKIES: CookieRow[] = [
  {
    name: "spanly_session",
    provider: "Spanlyfy (first-party)",
    category: "necessary",
    purpose:
      "Keeps you signed in. Holds an opaque, httpOnly session token validated server-side on each request.",
    duration: "30 days",
  },
  {
    name: "spanly_consent",
    provider: "Spanlyfy (first-party)",
    category: "necessary",
    purpose:
      "Remembers your cookie choices so we don't ask on every visit and only load what you've allowed.",
    duration: "180 days",
  },
  {
    name: "theme",
    provider: "Spanlyfy (first-party)",
    category: "necessary",
    purpose:
      "Remembers your light/dark theme preference. Stored in your browser; not used to track you.",
    duration: "Persistent (until cleared)",
  },
];

export const COOKIE_POLICY = {
  title: "Cookie Policy",
  effectiveDate: LEGAL.effectiveDate,
  intro: [
    `This Cookie Policy explains how ${LEGAL.legalEntity} ("Spanlyfy", "we", "us") uses cookies and similar technologies on ${LEGAL.domain}, and the choices you have. It supplements our Privacy Policy.`,
    "Cookies are small text files placed on your device when you visit a website. We also use comparable browser storage (such as localStorage) for the same purposes; we refer to all of these as \"cookies\" here.",
    "We group cookies into the categories below. Strictly necessary cookies are always active because the Service cannot run without them. All other categories are off until you opt in, and you can change your choices at any time using the “Manage cookies” control below or in our footer.",
  ],
  /** How users withdraw or change consent — required disclosure under PECR/GDPR. */
  manage: [
    "You can accept or reject non-essential cookies when you first visit, and revisit your choice anytime via “Manage cookies.” Rejecting is always as easy as accepting.",
    "You can also control cookies through your browser settings — blocking or deleting them — though strictly necessary cookies are needed for sign-in and core features to work.",
  ],
} as const;

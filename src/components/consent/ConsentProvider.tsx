"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ALL_GRANTED,
  NECESSARY_ONLY,
  readConsentCookie,
  writeConsentCookie,
  type ConsentState,
} from "@/lib/consent";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { CookiePreferencesDialog } from "./CookiePreferencesDialog";

// App-wide cookie-consent state. Mounted once at the root (inside ThemeProvider) so the
// banner shows on every surface — marketing, auth, legal, and the app shell — and any
// component can read the current consent or re-open the preferences dialog via useConsent().
//
// Why client-read (vs. reading the cookie in the server layout): keeping it on the client
// avoids forcing every page into dynamic rendering, and mirrors the existing AnnouncementBanner
// pattern (gate render on a `ready` flag to dodge a hydration flash). When real analytics are
// added they load client-side after `consent.analytics` is true — see AnalyticsScripts.tsx.

interface ConsentContextValue {
  /** True once the stored cookie has been read in the browser (avoids SSR flash). */
  ready: boolean;
  /** Whether the user has made an explicit choice (false → banner is shown). */
  hasResponded: boolean;
  /** Current granted categories. `necessary` is always true. */
  consent: ConsentState;
  acceptAll: () => void;
  rejectAll: () => void;
  /** Persist an arbitrary category selection (from the preferences dialog). */
  save: (state: ConsentState) => void;
  /** Open the granular preferences dialog (e.g. from a "Manage cookies" footer link). */
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within <ConsentProvider>");
  return ctx;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(NECESSARY_ONLY);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hydrate from the cookie once on mount.
  useEffect(() => {
    const record = readConsentCookie();
    if (record) {
      setConsent(record.categories);
      setHasResponded(true);
    }
    setReady(true);
  }, []);

  const persist = useCallback((state: ConsentState) => {
    writeConsentCookie(state);
    setConsent(state);
    setHasResponded(true);
    setDialogOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      hasResponded,
      consent,
      acceptAll: () => persist(ALL_GRANTED),
      rejectAll: () => persist(NECESSARY_ONLY),
      save: persist,
      openPreferences: () => setDialogOpen(true),
    }),
    [ready, hasResponded, consent, persist],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {/* Banner: only before a decision exists, and never on top of the dialog. */}
      {ready && !hasResponded && !dialogOpen ? <CookieConsentBanner /> : null}
      {dialogOpen ? (
        <CookiePreferencesDialog
          initial={consent}
          onClose={() => setDialogOpen(false)}
          onSave={persist}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}

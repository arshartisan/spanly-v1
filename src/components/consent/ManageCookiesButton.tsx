"use client";

import { useConsent } from "./ConsentProvider";

// A plain text trigger that re-opens the cookie preferences dialog. Drop this anywhere
// below <ConsentProvider> (e.g. site footers) to satisfy the requirement that users can
// withdraw or change consent as easily as they gave it. Styled to sit inline with footer
// links by default; pass `className` to override.
export function ManageCookiesButton({ className }: { className?: string }) {
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className ?? "transition-colors hover:text-foreground"}
    >
      Manage cookies
    </button>
  );
}

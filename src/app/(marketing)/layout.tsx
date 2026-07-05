import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingSmoothScroll } from "@/components/marketing/MarketingSmoothScroll";
import { isEnabled } from "@/server/settings/flags";

// Public marketing shell. Unlike the app/auth shells this does NOT force a single theme:
// each section paints its own background (orange / black / cream color-blocking), so the
// landing reads identically regardless of the visitor's light/dark preference.
//
// In `waitlist-mode` the full nav + footer are suppressed in favour of a bare emblem header:
// the waitlist landing (page.tsx) is a single-action page and must carry zero navigation.
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const waitlistMode = await isEnabled("waitlist-mode");

  if (waitlistMode) {
    return (
      <div className="dark flex min-h-screen flex-col bg-[hsl(20_14%_5%)] tracking-tight">
        <header className="px-6 pt-5 sm:px-10 lg:px-16">
          <Link href="/" className="press inline-flex items-center" aria-label="Spanlyfy home">
            <Logo className="h-7" />
          </Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(20_14%_5%)] tracking-tight">
      <MarketingSmoothScroll />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

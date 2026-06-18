import Link from "next/link";

import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Start free trial" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

// Dark footer crowned by an oversized Spanlyfy wordmark (the reference's big-logo footer),
// with link columns and a legal/cookies strip.
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]">
      <div className={cn("mx-auto max-w-7xl py-16", SECTION_X)}>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo className="h-7" />
            <p className="mt-3 text-sm text-[hsl(30_10%_70%)]">
              Schedule once, publish everywhere. One dashboard for Facebook, Instagram,
              LinkedIn, TikTok, YouTube and X.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <MonoLabel className="text-[hsl(30_10%_55%)]">{col.heading}</MonoLabel>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[hsl(30_10%_70%)] transition-colors hover:text-[hsl(30_25%_96%)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Oversized brand lockup: orange emblem beside an outlined wordmark. */}
        <div className="mt-14 flex items-center gap-3 sm:gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/emblem-white.svg"
            alt="Spanlyfy"
            width={814}
            height={814}
            className="h-[clamp(2.4rem,11vw,11rem)] w-auto select-none"
          />
          <span
            aria-hidden
            className="select-none font-display leading-none tracking-tight text-transparent"
            style={{
              fontSize: "clamp(3rem,15vw,15rem)",
              WebkitTextStroke: "1px hsl(30 25% 96% / 0.35)",
            }}
          >
            Spanlyfy
          </span>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-[hsl(30_10%_55%)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Spanlyfy. All rights reserved.</span>
          <nav className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[hsl(30_25%_96%)]">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[hsl(30_25%_96%)]">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-[hsl(30_25%_96%)]">
              Cookies
            </Link>
            <ManageCookiesButton className="transition-colors hover:text-[hsl(30_25%_96%)]" />
          </nav>
        </div>
      </div>
    </footer>
  );
}

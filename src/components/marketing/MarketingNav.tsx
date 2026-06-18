"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SECTION_X } from "./styles";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Nav rendered as an overlay on top of the hero: transparent while at the top (so it reads as
// part of the hero), gaining a translucent blurred bar once the page is scrolled so it stays
// legible over the lighter sections below. Fixed, so it never reserves a strip above the hero.
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 pt-3 sm:pt-4", SECTION_X)}>
      <div
        className={cn(
          "mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl border px-4 backdrop-blur-md transition-colors sm:px-6",
          scrolled || open
            ? "border-white/10 bg-[hsl(20_14%_5%)]/80"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="press flex items-center" aria-label="Spanlyfy home">
          <Logo className="h-7" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-[0.14em] text-[hsl(30_15%_78%)] transition-colors hover:text-[hsl(30_25%_96%)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            asChild
            variant="ghost"
            className="rounded-[6px] text-[hsl(30_25%_96%)] hover:bg-white/10 hover:text-[hsl(30_25%_96%)]"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="rounded-[6px]">
            <Link href="/signup">
              <span className="mr-1 inline-block h-2 w-2 bg-[hsl(20_30%_8%)]" aria-hidden />
              Start free trial
            </Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="press text-[hsl(30_25%_96%)] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/10 bg-[hsl(20_14%_5%)]/95 p-4 backdrop-blur-md md:hidden">
          <nav className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/5 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[hsl(30_10%_70%)] last:border-b-0"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              asChild
              variant="outline"
              className="rounded-[6px] border-white/20 bg-transparent text-[hsl(30_25%_96%)] hover:bg-white/10 hover:text-[hsl(30_25%_96%)]"
            >
              <Link href="/login" onClick={() => setOpen(false)}>
                Log in
              </Link>
            </Button>
            <Button asChild className="rounded-[6px]">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Start free trial
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

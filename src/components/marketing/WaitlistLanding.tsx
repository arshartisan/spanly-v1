import Link from "next/link";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { HeroArt } from "./HeroArt";
import { WaitlistForm } from "./WaitlistForm";
import { SECTION_X } from "./styles";

// Single-purpose waitlist landing shown when the `waitlist-mode` flag is on. Reuses the Hero's
// warm-orange radial-glow dark card and the 3D emblem, but strips every distraction (no nav,
// pricing, features or FAQ): one eyebrow, one promise, one email field. The social-proof line
// only renders when there's meaningful traction - below the threshold we say "be among the
// first" instead of flashing a tiny number.

// Below this many signups, a raw count reads as small/negative - show a softer line instead.
const PROOF_THRESHOLD = 25;

export function WaitlistLanding({ count }: { count: number }) {
  const showCount = count >= PROOF_THRESHOLD;

  return (
    <div className="px-3 sm:px-4">
      <section className="relative isolate my-4 min-h-dvh overflow-hidden rounded-[28px] border border-white/10 bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]">
        {/* Warm radial glow behind the emblem (mirrors the Hero). */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(100% 100% at 70% 44%, hsl(22 92% 50% / 0.9), hsl(16 86% 30% / 0.55) 40%, hsl(20 14% 5%) 78%)",
          }}
        />

        {/* 3D emblem, anchored right and kept inside the card. */}
        <div className="absolute right-[2%] top-[70%] -z-10 aspect-square w-[62%] -translate-y-1/2 sm:w-[52%] md:w-[46%] lg:w-[58%]">
          <HeroArt />
        </div>

        {/* Left/bottom dark wash keeps the copy legible over the artwork. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, hsl(20 14% 5%) 2%, hsl(20 14% 5% / 0.7) 34%, transparent 64%), linear-gradient(to top, hsl(20 14% 5%) 1%, transparent 30%)",
          }}
        />

        <div
          className={cn(
            "relative flex min-h-dvh flex-col justify-center pb-16 pt-16",
            SECTION_X,
          )}
        >
          <div className="max-w-2xl">
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.22em] text-[hsl(30_25%_96%)]/75">
              [ Now in early access ]
            </p>

            <h1 className="font-display text-3xl uppercase leading-[0.95] tracking-tighter sm:text-4xl lg:text-5xl">
              Schedule once.
              <br />
              Publish everywhere.
            </h1>

            <p className="mt-6 max-w-md text-sm leading-relaxed tracking-tight text-[hsl(30_18%_86%)] sm:text-base">
              Join the waitlist for early access and founder pricing - one workflow to schedule,
              publish and track posts across Facebook, Instagram, LinkedIn, TikTok, YouTube and X.
            </p>

            <WaitlistForm className="mt-8" />

            {/* Social proof - only when it helps. */}
            <p className="mt-5 flex items-center gap-2 text-sm text-[hsl(30_15%_74%)]">
              <Star className="h-4 w-4 fill-[hsl(22_92%_52%)] text-[hsl(22_92%_52%)]" aria-hidden />
              {showCount ? (
                <span>
                  <span className="font-medium text-[hsl(30_25%_96%)]">
                    {count.toLocaleString()}+
                  </span>{" "}
                  creators already waiting
                </span>
              ) : (
                <span>Be among the first to get in.</span>
              )}
            </p>
          </div>
        </div>

        {/* Minimal legal strip inside the card - the only links on the page. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10">
          <div
            className={cn(
              "flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(30_15%_70%)]",
              SECTION_X,
            )}
          >
            <span>© {new Date().getFullYear()} Spanlyfy</span>
            <nav className="pointer-events-auto flex items-center gap-4">
              <Link href="/terms" className="transition-colors hover:text-[hsl(30_25%_96%)]">
                Terms
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-[hsl(30_25%_96%)]">
                Privacy
              </Link>
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}

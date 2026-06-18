import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroArt } from "./HeroArt";
import { SECTION_X } from "./styles";

// Hero presented as an inset, rounded card (spaced from the page edges and the floating nav).
// A large metallic emblem sits in a warm orange-to-black gradient and bleeds past the card's
// rounded corners; the bold headline and CTAs sit bottom-left.
export function Hero() {
  return (
    <div className="px-3 sm:px-4">
      <section className="relative isolate my-4 min-h-dvh overflow-hidden rounded-[28px] border border-white/10 bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]">
        {/* Warm radial glow behind the emblem. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(100% 100% at 70% 44%, hsl(22 92% 50% / 0.9), hsl(16 86% 30% / 0.55) 40%, hsl(20 14% 5%) 78%)",
          }}
        />

        {/* 3D emblem (square), anchored right and kept inside the card. */}
        <div className="absolute right-[2%] top-[72%] -z-10 aspect-square w-[60%] -translate-y-1/2 sm:w-[52%] md:w-[46%] lg:w-[62%]">
          <HeroArt />
        </div>

        {/* Left/bottom dark wash keeps the headline legible over the artwork. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, hsl(20 14% 5%) 2%, hsl(20 14% 5% / 0.7) 30%, transparent 60%), linear-gradient(to top, hsl(20 14% 5%) 1%, transparent 28%)",
          }}
        />

        <div
          className={cn(
            "relative flex min-h-[calc(100vh-6rem)] flex-col justify-center pb-20 pt-16",
            SECTION_X,
          )}
        >
          <div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.22em] text-[hsl(30_25%_96%)]/75">
              [ Meet Spanlyfy ]
            </p>
            <h1 className="font-display text-3xl uppercase leading-[0.95] tracking-tighter sm:text-4xl lg:text-5xl ">
              Schedule once.
              <br />
              Publish everywhere.
            </h1>
          </div>

          <div>
            <p className="mt-6 max-w-md text-sm leading-relaxed tracking-tighter text-[hsl(30_18%_86%)] sm:text-base">
              Spanlyfy unifies scheduling, publishing and tracking for Facebook, Instagram,
              LinkedIn, TikTok, YouTube and X - one workflow, every channel.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-[6px]">
                <Link href="/signup">
                  Start free trial
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-[6px] border-white/30 bg-white/5 text-[hsl(30_25%_96%)] hover:bg-white/10 hover:text-[hsl(30_25%_96%)]"
              >
                <Link href="#features">
                  Explore features
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom markers, inside the card. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10">
          <div
            className={cn(
              "flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(30_15%_70%)]",
              SECTION_X,
            )}
          >
            <span className="inline-flex items-center gap-2">
              Scroll for more
              <ArrowDown className="h-3.5 w-3.5" />
            </span>
            <span>Est. 2026</span>
          </div>
        </div>
      </section>
    </div>
  );
}

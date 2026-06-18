import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FrameBrackets } from "./FrameBrackets";
import { GridTexture } from "./GridTexture";
import { MonoLabel } from "./MonoLabel";
import { IsometricCubes } from "./IsometricCubes";
import { SECTION_X } from "./styles";

// Closing CTA: dark band with grid texture + a cube accent and a bracketed headline.
export function FinalCTA() {
  return (
    <section className={cn("relative overflow-hidden bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]", SECTION_X)}>
      <GridTexture tone="onDark" />
      <div className="pointer-events-none absolute -right-10 bottom-0 hidden w-72 opacity-60 md:block">
        <IsometricCubes glow={false} />
      </div>
      <div className="relative mx-auto max-w-7xl py-24 md:py-32">
        <MonoLabel className="text-[hsl(22_92%_52%)]">Ready when you are</MonoLabel>
        <FrameBrackets tone="orange" size={22} className="mt-5 inline-block p-5 sm:p-7">
          <h2 className="max-w-2xl text-3xl leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
            Ready to grow on every platform?
          </h2>
        </FrameBrackets>
        <p className="mt-6 max-w-md text-[hsl(30_10%_70%)]">
          Start your 7-day free trial today. Cancel anytime, with a 7-day money-back guarantee.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="rounded-[6px]">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-[6px] border-white/25 bg-transparent text-[hsl(30_25%_96%)] hover:bg-white/10 hover:text-[hsl(30_25%_96%)]"
          >
            <Link href="#pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

import { cn } from "@/lib/utils";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const STEPS: { n: string; label: string; blurb: string }[] = [
  {
    n: "01",
    label: "Connect your accounts",
    blurb: "Link Facebook, Instagram, LinkedIn, TikTok, YouTube and X in a couple of clicks.",
  },
  {
    n: "02",
    label: "Create & customise",
    blurb: "Write once, then fine-tune the caption and media for each platform's format.",
  },
  {
    n: "03",
    label: "Schedule, queue or post",
    blurb: "Publish now, pick a time, or add it to a recurring queue that posts on autopilot.",
  },
];

// Light "the Spanlyfy way" block: three numbered steps.
export function HowItWorks() {
  return (
    <section className={cn("bg-[hsl(30_40%_99%)] text-[hsl(24_24%_12%)]", SECTION_X)}>
      <div className="mx-auto max-w-7xl py-20 md:py-28">
        <MonoLabel className="text-[hsl(22_92%_52%)]">The Spanlyfy way</MonoLabel>
        <h2 className="mt-4 max-w-2xl text-3xl leading-tight tracking-tight sm:text-4xl">
          From blank calendar to fully scheduled in three steps.
        </h2>

        <div className="mt-12 grid gap-px border border-black/10 bg-black/10 md:grid-cols-3">
          {STEPS.map(({ n, label, blurb }) => (
            <div key={n} className="h-full bg-[hsl(30_40%_99%)] p-8">
              <span className="font-display text-5xl text-[hsl(22_92%_52%)]">{n}</span>
              <MonoLabel className="mt-6 block text-[hsl(24_24%_12%)]">{label}</MonoLabel>
              <p className="mt-3 text-sm text-[hsl(24_10%_42%)]">{blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

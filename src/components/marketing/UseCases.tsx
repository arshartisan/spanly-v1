import { CalendarRange, Layers, Repeat2, BarChart3, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const CASES: { label: string; blurb: string; Icon: LucideIcon }[] = [
  {
    label: "Plan your week",
    blurb: "Map out a full week of content on the calendar and approve it in one sitting.",
    Icon: CalendarRange,
  },
  {
    label: "Bulk schedule",
    blurb: "Drop in dozens of videos or images and schedule them all in a single batch.",
    Icon: Layers,
  },
  {
    label: "Repurpose content",
    blurb: "Turn one piece into platform-native posts with tailored captions for each.",
    Icon: Repeat2,
  },
  {
    label: "Grow every channel",
    blurb: "Keep all your accounts active and consistent - then track what lands (beta).",
    Icon: BarChart3,
  },
];

// Dark four-card grid of use cases.
export function UseCases() {
  return (
    <section className={cn("bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]", SECTION_X)}>
      <div className="mx-auto max-w-7xl py-20 md:py-28">
        <MonoLabel className="text-[hsl(22_92%_52%)]">What you can do</MonoLabel>
        <h2 className="mt-4 max-w-2xl text-3xl leading-tight tracking-tight sm:text-4xl">
          Built for the way creators and teams actually post.
        </h2>

        <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {CASES.map(({ label, blurb, Icon }) => (
            <div key={label} className="h-full bg-[hsl(20_14%_5%)] p-7">
              <Icon className="h-6 w-6 text-[hsl(22_92%_52%)]" />
              <MonoLabel className="mt-5 block text-[hsl(30_25%_96%)]">{label}</MonoLabel>
              <p className="mt-3 text-sm text-[hsl(30_10%_70%)]">{blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

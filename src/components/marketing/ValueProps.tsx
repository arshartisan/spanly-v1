import { Clock, Rocket, TrendingUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FrameBrackets } from "./FrameBrackets";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const PROPS: { label: string; blurb: string; Icon: LucideIcon }[] = [
  {
    label: "Ship content faster",
    blurb: "Draft once and fan it out to every platform with per-channel captions in seconds.",
    Icon: Rocket,
  },
  {
    label: "Save hours every week",
    blurb: "Bulk uploads and a recurring queue replace the daily manual-posting grind.",
    Icon: Clock,
  },
  {
    label: "Built to scale",
    blurb: "Connect up to 15, 50 or unlimited accounts and grow into agencies and brands.",
    Icon: TrendingUp,
  },
];

// Light value-prop block: a bold left headline with orange-highlighted phrases, and a stack
// of dark corner-bracketed cards on the right (the reference's "you don't have to wait" row).
export function ValueProps() {
  return (
    <section className={cn("bg-[hsl(30_40%_99%)] text-[hsl(24_24%_12%)]", SECTION_X)}>
      <div className="mx-auto grid max-w-7xl gap-12 py-20 md:grid-cols-2 md:py-28">
        <div>
          <MonoLabel className="text-[hsl(22_92%_52%)]">The payoff</MonoLabel>
          <h2 className="mt-4 text-3xl leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.75rem]">
            You don&apos;t have to juggle{" "}
            <span className="text-[hsl(22_92%_52%)]">six tabs</span> and post{" "}
            <span className="text-[hsl(22_92%_52%)]">manually every day</span> to stay visible.
          </h2>
          <p className="mt-6 max-w-md text-[hsl(24_10%_42%)]">
            Set up your channels once, batch a week of content, and let Spanlyfy handle the
            rest - so you can focus on creating instead of posting.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {PROPS.map(({ label, blurb, Icon }) => (
            <FrameBrackets
              key={label}
              tone="orange"
              size={14}
              className="bg-[hsl(20_14%_5%)] p-6 text-[hsl(30_25%_96%)]"
            >
              <div className="flex items-start gap-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(22_92%_52%)]" />
                <div>
                  <MonoLabel className="text-[hsl(30_25%_96%)]">{label}</MonoLabel>
                  <p className="mt-2 text-sm text-[hsl(30_10%_70%)]">{blurb}</p>
                </div>
              </div>
            </FrameBrackets>
          ))}
        </div>
      </div>
    </section>
  );
}

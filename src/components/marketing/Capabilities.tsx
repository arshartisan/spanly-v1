import { cn } from "@/lib/utils";
import { WorkflowFlow } from "./WorkflowFlow";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const CAPABILITIES: { label: string; blurb: string }[] = [
  {
    label: "Multi-platform publishing",
    blurb: "One composer, six platforms. Customise each caption without retyping the post.",
  },
  {
    label: "Smart scheduling & queue",
    blurb: "Post now, pick an exact time, or drop it in a recurring queue that posts for you.",
  },
  {
    label: "Bulk + AI content studio",
    blurb: "Upload dozens of clips at once and spin up videos from templates in minutes.",
  },
  {
    label: "Visual content calendar",
    blurb: "See every scheduled post across every channel on one drag-friendly calendar.",
  },
];

// Light "what it does" block: intro copy + an underlined capability list on the left, a
// dark panel with the workflow diagram on the right.
export function Capabilities() {
  return (
    <section className={cn("bg-[hsl(30_40%_99%)] text-[hsl(24_24%_12%)]", SECTION_X)} id="features">
      <div className="mx-auto grid max-w-7xl gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
        <div>
          <MonoLabel className="text-[hsl(22_92%_52%)]">What Spanlyfy does</MonoLabel>
          <h2 className="mt-4 max-w-md text-3xl leading-tight tracking-tight sm:text-4xl">
            Everything you need to run every channel from one place.
          </h2>
          <p className="mt-4 max-w-md text-[hsl(24_10%_42%)]">
            Stop copy-pasting between apps. Spanlyfy brings creation, scheduling and
            publishing into a single, fast workflow built for people who post a lot.
          </p>

          <ul className="mt-10 divide-y divide-black/10 border-y border-black/10">
            {CAPABILITIES.map((c) => (
              <li
                key={c.label}
                className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <MonoLabel className="shrink-0 text-[hsl(24_24%_12%)] sm:w-56">
                  {c.label}
                </MonoLabel>
                <p className="text-sm text-[hsl(24_10%_42%)]">{c.blurb}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden bg-[hsl(20_14%_5%)] p-8">
          <div className="flex h-full flex-col justify-between gap-8">
            <MonoLabel className="text-[hsl(30_10%_70%)]">One workflow</MonoLabel>
            <WorkflowFlow />
            <p className="text-sm text-[hsl(30_10%_70%)]">
              Create, schedule and track - no tab-juggling, no missed posts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

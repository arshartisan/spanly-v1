import { cn } from "@/lib/utils";
import { FrameBrackets } from "./FrameBrackets";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

// PLACEHOLDER COPY - Spanlyfy has no real testimonials yet. Replace these quotes, names and
// roles with genuine customer feedback before launch (do not ship fabricated attributions).
const QUOTES: { quote: string; name: string; role: string }[] = [
  {
    quote:
      "I batch a week of content on Sunday and forget about it. Spanlyfy posts everything on time, everywhere.",
    name: "Placeholder Name",
    role: "Content creator",
  },
  {
    quote:
      "Managing six brand accounts used to eat my mornings. Now it's one calendar and a queue.",
    name: "Placeholder Name",
    role: "Social media manager",
  },
  {
    quote:
      "The per-platform captions are the killer feature - one post, native everywhere.",
    name: "Placeholder Name",
    role: "Founder",
  },
];

// Light testimonial block - quote cards. Copy is placeholder until real quotes exist.
export function Testimonials() {
  return (
    <section className={cn("bg-[hsl(30_40%_99%)] text-[hsl(24_24%_12%)]", SECTION_X)}>
      <div className="mx-auto max-w-7xl py-20 md:py-28">
        <MonoLabel className="text-[hsl(22_92%_52%)]">Loved by busy posters</MonoLabel>
        <h2 className="mt-4 max-w-2xl text-3xl leading-tight tracking-tight sm:text-4xl">
          Less time posting. More time creating.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {QUOTES.map((t, i) => (
            <FrameBrackets key={i} tone="orange" size={14} className="h-full bg-white p-7">
              <p className="text-base leading-relaxed text-[hsl(24_24%_12%)]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6">
                <MonoLabel className="block text-[hsl(24_24%_12%)]">{t.name}</MonoLabel>
                <span className="text-xs text-[hsl(24_10%_42%)]">{t.role}</span>
              </div>
            </FrameBrackets>
          ))}
        </div>
      </div>
    </section>
  );
}

import { cn } from "@/lib/utils";
import { FrameBrackets } from "./FrameBrackets";
import { GridTexture } from "./GridTexture";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

// Full-bleed orange statement band. Two layouts: a split (headline left, body right) and a
// centered single-headline variant - both echoing the reference's bold orange interludes.
export function OrangeStatement({
  eyebrow,
  headline,
  body,
  center = false,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  body?: string[];
  center?: boolean;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-[hsl(22_92%_52%)] text-[hsl(20_30%_8%)]", SECTION_X)}>
      <GridTexture tone="onOrange" />
      <div
        className={cn(
          "relative mx-auto max-w-7xl py-20 md:py-28",
          center ? "text-center" : "grid items-center gap-10 md:grid-cols-2",
        )}
      >
        <div className={cn(center && "mx-auto max-w-4xl")}>
          {eyebrow && <MonoLabel className="text-[hsl(20_30%_8%)]/70">{eyebrow}</MonoLabel>}
          <FrameBrackets tone="dark" size={22} className="mt-5 inline-block p-4 sm:p-6">
            <h2 className="text-3xl leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
              {headline}
            </h2>
          </FrameBrackets>
        </div>

        {!center && body && (
          <div className="space-y-5">
            {body.map((p, i) => (
              <p key={i} className="text-lg leading-relaxed text-[hsl(20_30%_8%)]/85">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

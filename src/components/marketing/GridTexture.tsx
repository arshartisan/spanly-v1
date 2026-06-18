import { cn } from "@/lib/utils";

/**
 * Faint grid-line overlay used behind the big orange statement bands (and dark CTA blocks)
 * in the reference design. Absolutely positioned; drop it as the first child of a
 * `relative` block. `tone` picks line color for orange vs. dark backgrounds.
 */
export function GridTexture({
  className,
  tone = "onOrange",
  size = 48,
}: {
  className?: string;
  tone?: "onOrange" | "onDark";
  size?: number;
}) {
  const line =
    tone === "onDark" ? "hsl(28 90% 55% / 0.10)" : "hsl(20 30% 8% / 0.12)";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

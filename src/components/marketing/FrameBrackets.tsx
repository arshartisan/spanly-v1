import { cn } from "@/lib/utils";

/**
 * Corner-bracket frame - the four L-shaped "targeting" marks that wrap hero text, big
 * statement headlines and CTAs in the reference design. Renders its children inside a
 * relatively-positioned box with an absolutely-positioned L at each corner.
 *
 * `tone` picks the bracket color for the surrounding block; `inset`/`size` tune the marks.
 */
export function FrameBrackets({
  children,
  className,
  tone = "light",
  size = 18,
  inset = 0,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark" | "orange";
  size?: number;
  inset?: number;
}) {
  const color =
    tone === "dark"
      ? "border-[hsl(24_24%_12%)]"
      : tone === "orange"
        ? "border-[hsl(22_92%_52%)]"
        : "border-[hsl(30_25%_96%)]";

  const corners = [
    "top-0 left-0 border-l-2 border-t-2",
    "top-0 right-0 border-r-2 border-t-2",
    "bottom-0 left-0 border-l-2 border-b-2",
    "bottom-0 right-0 border-r-2 border-b-2",
  ];

  return (
    <div className={cn("relative", className)}>
      {corners.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className={cn("pointer-events-none absolute block", color, c)}
          style={{ width: size, height: size, margin: inset }}
        />
      ))}
      {children}
    </div>
  );
}

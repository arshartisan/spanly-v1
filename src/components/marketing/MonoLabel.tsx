import { cn } from "@/lib/utils";

/**
 * Uppercase, letter-spaced technical label used as a section eyebrow or card title -
 * the "AI STACK" / "FASTER SOFTWARE DEVELOPMENT" treatment from the reference design.
 * Defaults to a muted tone; pass `className` to recolor for dark/light/orange blocks.
 */
export function MonoLabel({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  return (
    <Tag
      className={cn(
        "font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

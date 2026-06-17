import { cn } from "@/lib/utils";

/**
 * Spanlyfy brand lockup: the square emblem followed by the wordmark. Each is a pair of
 * static SVGs (in /public) swapped purely in CSS by theme — black art on light, white art
 * on dark — so the lockup tracks next-themes' `.dark` class with no hydration flash and
 * works in server components. Both emblems keep their orange tile; only the "S" flips.
 *
 * `className` sets the lockup height (e.g. `h-7`); the emblem stays square and the wordmark
 * keeps its 2392×631 ratio. Pass `emblemOnly` to render just the tile (e.g. collapsed nav).
 */
export function Logo({
  className,
  emblemOnly = false,
}: {
  className?: string;
  emblemOnly?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* Emblem — square tile, fills the lockup height. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/emblem-black.svg"
        alt="Spanlyfy"
        width={814}
        height={814}
        className="block h-full w-auto select-none dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/emblem-white.svg"
        alt="Spanlyfy"
        width={814}
        height={814}
        className="hidden h-full w-auto select-none dark:block"
      />

      {/* Wordmark — hidden when only the emblem is wanted. */}
      {!emblemOnly && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-black.svg"
            alt=""
            width={2392}
            height={631}
            aria-hidden
            className="block h-[82%] w-auto select-none dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-white.svg"
            alt=""
            width={2392}
            height={631}
            aria-hidden
            className="hidden h-[82%] w-auto select-none dark:block"
          />
        </>
      )}
    </span>
  );
}

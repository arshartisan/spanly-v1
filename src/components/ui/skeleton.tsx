import { cn } from "@/lib/utils";

/**
 * shadcn/ui Skeleton — a pulsing placeholder used while content loads (route-level
 * loading.tsx files and client data fetches). Tuned for the warm-dark glass theme:
 * `bg-foreground/10` reads as a subtle neutral on both the page background and the
 * lighter glass cards, in light and dark mode alike.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
      {...props}
    />
  );
}

export { Skeleton };

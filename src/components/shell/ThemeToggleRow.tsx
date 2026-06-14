"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Visible light/dark switch pinned in the sidebar footer (mirrors the reference
 * dashboard's "Dark Mode" row). The theme menu also lives in the account menu,
 * but this is the discoverable, one-tap control.
 *
 * `resolvedTheme` is used so the switch reflects the real applied theme even when
 * the stored preference is "system". A mounted guard prevents the hydration
 * mismatch that next-themes warns about (server renders with no theme known).
 */
export function ThemeToggleRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="flex-1 text-left">{isDark ? "Dark mode" : "Light mode"}</span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          isDark ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
            isDark ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { switchTheme } from "@/lib/theme-transition";

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Visible light/dark switch pinned in the sidebar footer (mirrors the reference
 * dashboard's "Dark Mode" row). The theme menu also lives in the account menu,
 * but this is the discoverable, one-tap control.
 *
 * Clicking triggers a circular-reveal theme transition originating from the cursor
 * (switchTheme), the sun/moon icon morphs, and the thumb springs across. `resolvedTheme`
 * reflects the real applied theme even when the stored preference is "system"; a mounted
 * guard avoids the next-themes hydration mismatch.
 */
export function ThemeToggleRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  function onToggle(e: React.MouseEvent<HTMLButtonElement>) {
    switchTheme(isDark ? "light" : "dark", setTheme, { x: e.clientX, y: e.clientY });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={onToggle}
      className="press flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inline-flex"
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="flex-1 text-left">{isDark ? "Dark mode" : "Light mode"}</span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          isDark ? "bg-primary" : "bg-input",
        )}
      >
        <motion.span
          className="inline-block h-4 w-4 rounded-full bg-background shadow"
          animate={{ x: isDark ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}

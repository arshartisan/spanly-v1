import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Switch the theme with a circular-reveal animation that wipes the new theme in from the
 * click position (View Transitions API). Falls back to an instant switch when the browser
 * lacks the API or the user prefers reduced motion.
 *
 * `flushSync` forces next-themes' DOM update to happen *inside* the transition snapshot so
 * the API captures the before/after states correctly. Pair with the
 * `::view-transition-*(root)` rules in globals.css.
 */
export function switchTheme(
  next: string,
  setTheme: (theme: string) => void,
  origin?: { x: number; y: number },
) {
  const doc = document as ViewTransitionDocument;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!doc.startViewTransition || reduce) {
    setTheme(next);
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = doc.startViewTransition(() => {
    flushSync(() => setTheme(next));
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: EASE,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      /* transition skipped/interrupted — theme already applied */
    });
}

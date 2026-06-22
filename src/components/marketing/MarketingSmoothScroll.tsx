"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Document-level Lenis smooth scroll for the public landing page. Unlike the authenticated
 * shell (which locks window scroll and binds Lenis to <main>), the marketing layout scrolls
 * the document normally, so Lenis runs in default window mode — which keeps `position: sticky`
 * on the nav working. Lenis's built-in `anchors` eases in-page hash links (#features/#pricing/
 * #faq) to their target with a sticky-header offset, and `autoRaf` drives its own frame loop.
 * Disabled under prefers-reduced-motion (native scrolling takes over).
 *
 * Renders nothing; drop it once inside the marketing layout.
 */
export function MarketingSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.12, // a touch of weight without feeling laggy
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      autoRaf: true, // let Lenis run its own requestAnimationFrame loop
      anchors: { offset: -72 }, // ease #section links, clearing the sticky header
    });

    return () => lenis.destroy();
  }, []);

  return null;
}

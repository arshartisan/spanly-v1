"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Document-level Lenis smooth scroll for the public landing page. Unlike the authenticated
 * shell (which locks window scroll and binds Lenis to <main>), the marketing layout scrolls
 * the document normally, so Lenis runs in default window mode - which keeps `position: sticky`
 * on the nav working. In-page hash links (#features/#pricing/#faq) are intercepted and eased
 * to with an offset for the sticky header. Disabled under prefers-reduced-motion.
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
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Smooth-scroll same-page anchor links (the nav/footer #section links).
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      const hash = anchor?.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72 });
    };
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);

  return null;
}

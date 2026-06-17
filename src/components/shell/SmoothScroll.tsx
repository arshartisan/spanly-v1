"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Smooth-scrolls the authenticated shell's main content. The app locks window scroll
 * (`overflow-hidden` on the shell) and scrolls inside <main>, so Lenis is bound to that
 * element via `wrapper`/`content` rather than the document. Disabled when the user prefers
 * reduced motion - native scrolling takes over.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      wrapper,
      content,
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

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <main ref={wrapperRef} className="lenis flex-1 overflow-y-auto">
      <div ref={contentRef}>{children}</div>
    </main>
  );
}

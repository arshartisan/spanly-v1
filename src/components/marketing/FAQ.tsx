"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Which platforms does Spanlyfy support?",
    a: "Facebook, Instagram, LinkedIn, TikTok, YouTube and X - all from a single composer with per-platform captions.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan starts with a 7-day free trial, and we back it with a 7-day money-back guarantee.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. You can cancel whenever you like - there are no long-term contracts or lock-in.",
  },
  {
    q: "How many accounts can I connect?",
    a: "Creator includes 15 connected accounts, Growth includes 50, and Pro is unlimited. You can upgrade as you grow.",
  },
  {
    q: "Do you offer an API?",
    a: "Yes - a REST API plus an MCP endpoint for AI agents is available as a $5/mo add-on for programmatic posting and automation.",
  },
  {
    q: "Can I schedule in bulk?",
    a: "Yes. Upload dozens of images or videos at once and schedule the whole batch, or drop posts into a recurring queue.",
  },
];

// Lightweight accordion - no extra dependency. Uses a grid-rows 0fr->1fr transition so each
// answer animates open/closed smoothly.
export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className={cn("bg-[hsl(20_14%_5%)] text-[hsl(30_25%_96%)]", SECTION_X)} id="faq">
      <div className="mx-auto max-w-3xl py-20 md:py-28">
        <MonoLabel className="text-[hsl(22_92%_52%)]">FAQ</MonoLabel>
        <h2 className="mt-4 text-3xl leading-tight tracking-tight sm:text-4xl">
          Questions, answered.
        </h2>

        <div className="mt-10 border-t border-white/10">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium sm:text-lg">{item.q}</span>
                  <Plus
                    className={cn(
                      "h-5 w-5 shrink-0 text-[hsl(22_92%_52%)] transition-transform duration-300",
                      isOpen && "rotate-45",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-[hsl(30_10%_70%)]">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Circular character-counter ring (doc 01). Turns red when over the limit. */
function CounterRing({ value, limit }: { value: number; limit: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / limit, 1);
  const over = value > limit;
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums">
      <span className={cn("text-muted-foreground", over && "font-medium text-destructive")}>
        {value} / {limit}
      </span>
      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
        <circle cx="11" cy="11" r={radius} fill="none" strokeWidth="2" className="stroke-muted" />
        <circle
          cx="11"
          cy="11"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className={cn("stroke-primary transition-all", over && "stroke-destructive")}
        />
      </svg>
    </span>
  );
}

export function CaptionField({
  value,
  onChange,
  limit,
  label = "Main Caption",
  placeholder = "Start writing your post here…",
  disabled = false,
  onEnhance,
  enhancing = false,
  enhanceDisabledReason,
}: {
  value: string;
  onChange: (v: string) => void;
  limit: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When provided, renders the "Enhance with AI" button in the footer. */
  onEnhance?: () => void;
  enhancing?: boolean;
  /** When set, the Enhance button is disabled and shows this as its tooltip. */
  enhanceDisabledReason?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm transition-shadow focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-ring">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={7}
          className="w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <div
          className={cn(
            "flex items-center px-3 py-1.5",
            onEnhance ? "justify-between" : "justify-end",
          )}
        >
          {onEnhance && (
            <button
              type="button"
              onClick={onEnhance}
              disabled={disabled || enhancing || Boolean(enhanceDisabledReason)}
              title={enhanceDisabledReason ?? "Generate an enhanced caption + hashtags"}
              className="press inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enhancing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {enhancing ? "Enhancing…" : "Enhance with AI"}
            </button>
          )}
          <CounterRing value={value.length} limit={limit} />
        </div>
      </div>
    </div>
  );
}

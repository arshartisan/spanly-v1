"use client";

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
}: {
  value: string;
  onChange: (v: string) => void;
  limit: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={7}
          className="w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <div className="flex justify-end px-3 py-1.5">
          <CounterRing value={value.length} limit={limit} />
        </div>
      </div>
    </div>
  );
}

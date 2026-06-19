"use client";

import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedCaption } from "./types";

/**
 * Preview panel for the "Enhance with AI" result (doc: AI caption assistant). Shows the
 * generated caption + hashtags and lets the user Apply, Regenerate, or Close — it never
 * overwrites the draft until Apply is clicked. Loading + error states render in place.
 */
export function AiSuggestionPanel({
  suggestion,
  loading,
  error,
  onApply,
  onRegenerate,
  onClose,
}: {
  suggestion: GeneratedCaption | null;
  loading: boolean;
  error: string | null;
  onApply: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="glass flex flex-col gap-3 rounded-xl border border-primary/30 p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          AI Suggestion
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close suggestion"
          className="press rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : suggestion ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{suggestion.caption}</p>
          {suggestion.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestion.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply} disabled={loading || !!error || !suggestion}>
          <Check />
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} loading={loading}>
          {!loading && <RotateCcw />}
          Regenerate
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

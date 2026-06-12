"use client";

import { AlertCircle, Check } from "lucide-react";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { cn } from "@/lib/utils";
import type { ComposerAccount } from "./types";

/**
 * Account avatar row (doc 01/06). Only accounts eligible for the post type are shown;
 * clicking toggles membership in `targets`. A red ring + badge surfaces per-account
 * validation errors (e.g. caption over that platform's limit).
 */
export function AccountSelector({
  accounts,
  selected,
  invalidIds,
  onToggle,
}: {
  accounts: ComposerAccount[];
  selected: string[];
  invalidIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No connected accounts support this post type.{" "}
        <a href="/connections" className="text-primary underline-offset-2 hover:underline">
          Connect an account
        </a>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {accounts.map((a) => {
        const style = PLATFORM_STYLE[a.platform];
        const Icon = style.Icon;
        const isSelected = selected.includes(a.id);
        const isInvalid = isSelected && invalidIds.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onToggle(a.id)}
            title={`${a.handle} (${style.label})`}
            className="flex flex-col items-center gap-1"
          >
            <span className="relative">
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-white transition-all",
                  !isSelected && "opacity-40 grayscale",
                  isInvalid && "ring-2 ring-destructive ring-offset-2",
                  isSelected && !isInvalid && "ring-2 ring-primary ring-offset-2",
                )}
                style={{ backgroundColor: style.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              {isSelected && !isInvalid && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              {isInvalid && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-destructive p-0.5 text-white">
                  <AlertCircle className="h-3 w-3" />
                </span>
              )}
            </span>
            <span className="max-w-[64px] truncate text-[11px] text-muted-foreground">
              {a.handle}
            </span>
          </button>
        );
      })}
    </div>
  );
}

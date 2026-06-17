"use client";

import { AlertTriangle, Check } from "lucide-react";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { cn } from "@/lib/utils";
import type { ComposerAccount } from "./types";

/**
 * Account picker (doc 01/06) rendered as a glass card: header with a selected counter and
 * select-all / clear, then a row of avatars. Selecting toggles membership in `targets`.
 *
 * Only *account-specific* problems (caption over a platform's limit, unsupported type) flag an
 * avatar - shown in amber with a tooltip reason, never the alarming red that used to read like
 * "account disconnected". Missing shared content (no image/caption yet) is surfaced separately
 * by the composer as a next-step hint, not on every avatar.
 */
export function AccountSelector({
  accounts,
  selected,
  invalidIds,
  issues,
  onToggle,
  onSelectAll,
  onClear,
}: {
  accounts: ComposerAccount[];
  selected: string[];
  invalidIds: Set<string>;
  issues?: Map<string, string[]>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  if (accounts.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
        No connected accounts support this post type.{" "}
        <a href="/connections" className="font-medium text-primary underline-offset-2 hover:underline">
          Connect an account
        </a>
        .
      </div>
    );
  }

  const allSelected = selected.length === accounts.length;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Publish to</h2>
          <p className="text-xs text-muted-foreground">
            {selected.length} of {accounts.length} account{accounts.length > 1 ? "s" : ""} selected
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className="rounded-full px-2 py-1 text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={selected.length === 0}
            className="rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {accounts.map((a) => {
          const style = PLATFORM_STYLE[a.platform];
          const Icon = style.Icon;
          const isSelected = selected.includes(a.id);
          const isInvalid = isSelected && invalidIds.has(a.id);
          const reasons = issues?.get(a.id);
          const title = reasons?.length
            ? `${a.handle} - ${reasons.join(" · ")}`
            : `${a.handle} (${style.label})`;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              title={title}
              aria-pressed={isSelected}
              className="press group flex w-[68px] flex-col items-center gap-1.5"
            >
              <span className="relative">
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-white transition-all duration-200",
                    !isSelected && "opacity-40 grayscale group-hover:opacity-70",
                    isSelected && !isInvalid && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isInvalid && "ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: style.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {isSelected && !isInvalid && (
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary p-0.5 text-primary-foreground ring-2 ring-background">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {isInvalid && (
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-500 p-0.5 text-white ring-2 ring-background">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[11px] transition-colors",
                  isSelected ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {a.handle}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { Instagram, Facebook, X } from "lucide-react";

/**
 * Instagram connect-method chooser (docs/implementation/05 + 14). Instagram can be linked
 * either directly ("Login with Instagram") or via a connected Facebook Page
 * ("Login with Facebook" — Business/Creator accounts). The choice is forwarded as ?method=.
 * Lightweight modal (no Radix Dialog dependency).
 */
export function InstagramMethodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const choose = (method: "instagram" | "facebook") => {
    window.location.href = `/api/connect/instagram/start?method=${method}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Connect Instagram</h2>
            <p className="text-sm text-muted-foreground">Choose how to connect your account.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => choose("instagram")}
            className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E1306C] text-white">
              <Instagram className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Login with Instagram</span>
              <span className="block text-xs text-muted-foreground">Personal or Creator account</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("facebook")}
            className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1877F2] text-white">
              <Facebook className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Login with Facebook</span>
              <span className="block text-xs text-muted-foreground">
                Business/Creator account linked to a Page
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

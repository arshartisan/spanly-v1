"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Feature-flag toggle for the admin settings page (doc 20). PATCHes
// /api/admin/settings/flags/[key] with { enabled }, optimistically flips, reverts on
// failure with an inline error, and router.refresh()es the RSC on success. Mirrors the
// <RunMaintenance/> action pattern. `disabled` is set for global kill switches when the
// viewer is not a superadmin (the API also enforces this — never trust the client).

export function FlagToggle({
  flagKey,
  enabled,
  disabled = false,
  disabledHint,
  labelId,
}: {
  flagKey: string;
  enabled: boolean;
  disabled?: boolean;
  disabledHint?: string;
  labelId?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    if (pending || disabled) return;
    setError(null);
    setPending(true);
    setChecked(next); // optimistic
    try {
      const res = await fetch(`/api/admin/settings/flags/${encodeURIComponent(flagKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setChecked(!next); // revert
        setError(data?.error ?? "Could not update this flag.");
        return;
      }
      router.refresh();
    } catch {
      setChecked(!next); // revert
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : disabled ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        ) : null}
        <Switch
          checked={checked}
          onCheckedChange={toggle}
          disabled={disabled || pending}
          id={labelId}
        />
      </div>
      {error ? <p className="max-w-[180px] text-right text-[11px] text-status-failed">{error}</p> : null}
      {disabled && disabledHint ? (
        <p className="max-w-[180px] text-right text-[11px] text-muted-foreground">{disabledHint}</p>
      ) : null}
    </div>
  );
}

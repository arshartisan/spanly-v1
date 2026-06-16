"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Activate/deactivate (PATCH { active }) + delete (DELETE behind a confirm popover) for an
// announcement row (doc 20). router.refresh()es on success, reverts the toggle on failure,
// surfaces inline errors. Mirrors the <ContentModeration/> client action pattern.

export function AnnouncementActions({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(active);
  const [togglePending, setTogglePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(next: boolean) {
    if (togglePending) return;
    setError(null);
    setTogglePending(true);
    setChecked(next); // optimistic
    try {
      const res = await fetch(`/api/admin/settings/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setChecked(!next); // revert
        setError(data?.error ?? "Could not update.");
        return;
      }
      router.refresh();
    } catch {
      setChecked(!next);
      setError("Network error.");
    } finally {
      setTogglePending(false);
    }
  }

  async function remove() {
    setError(null);
    setDeletePending(true);
    try {
      const res = await fetch(`/api/admin/settings/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not delete.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {togglePending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <span>{checked ? "Active" : "Inactive"}</span>
          <Switch checked={checked} onCheckedChange={toggleActive} disabled={togglePending} />
        </label>

        <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-status-failed/40 px-2 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
              aria-label="Delete announcement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Delete announcement?</p>
                <p className="text-xs text-muted-foreground">
                  This permanently removes it. Customers will no longer see it.
                </p>
              </div>
              {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletePending}
                  onClick={remove}
                >
                  {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && !confirmOpen ? (
        <p className="text-[11px] text-status-failed">{error}</p>
      ) : null}
    </div>
  );
}

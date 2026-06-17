"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Delete action for a plan-catalog row (superadmin-only; gated by the parent). Confirm
// popover → DELETE /api/admin/plans/[key] → router.refresh() on success. The API returns a
// 409 when the plan still has live subscribers or is the last active plan; that message is
// surfaced inline. When `subscriberCount > 0` the confirm warns the admin to set the plan
// inactive instead. Mirrors AnnouncementActions / UserActions delete popovers.

export function PlanActions({
  planKey,
  planName,
  subscriberCount,
}: {
  planKey: string;
  planName: string;
  subscriberCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSubscribers = subscriberCount > 0;

  async function remove() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(planKey)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not delete this plan.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-status-failed/40 px-2 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
          aria-label={`Delete ${planName} plan`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Delete the {planName} plan?</p>
            <p className="text-xs text-muted-foreground">
              This permanently removes the tier from the catalog.
            </p>
          </div>
          {hasSubscribers ? (
            <p className="rounded-lg border border-status-draft/30 bg-status-draft/10 px-3 py-2 text-[11px] text-status-draft">
              {subscriberCount} subscriber{subscriberCount === 1 ? " is" : "s are"} on this plan.
              Deleting is blocked — set the plan inactive instead so existing subscribers keep
              working.
            </p>
          ) : null}
          {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={pending}
              onClick={remove}
            >
              Delete
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PlayCircle } from "lucide-react";
import type { MaintenanceTask } from "@/server/queue/names";
import { Button } from "@/components/ui/button";

// Manual maintenance-sweep triggers (doc 19). Each button enqueues a one-off sweep via the
// maintenance route and shows an "Enqueued" confirmation / inline error. Mirrors the
// <ForceDisconnect/> action pattern. Only rendered for admins (gated on the page).

const TASKS: { task: MaintenanceTask; label: string; description: string }[] = [
  {
    task: "missed-run-sweep",
    label: "Missed-run sweep",
    description: "Re-enqueue posts whose scheduled time slipped past.",
  },
  {
    task: "drafts-cleanup",
    label: "Drafts cleanup",
    description: "Prune stale, abandoned draft posts.",
  },
  {
    task: "token-refresh-sweep",
    label: "Token refresh sweep",
    description: "Proactively refresh access tokens nearing expiry.",
  },
];

export function RunMaintenance() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TASKS.map((t) => (
        <MaintenanceButton key={t.task} {...t} />
      ))}
    </div>
  );
}

function MaintenanceButton({
  task,
  label,
  description,
}: {
  task: MaintenanceTask;
  label: string;
  description: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setDone(false);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/system/maintenance/${task}`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to enqueue.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass flex flex-col gap-2 rounded-xl border border-border/50 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={run}
        className="mt-auto justify-center"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <Check className="h-3.5 w-3.5 text-status-posted" />
        ) : (
          <PlayCircle className="h-3.5 w-3.5" />
        )}
        {pending ? "Enqueuing…" : done ? "Enqueued" : "Run sweep"}
      </Button>
      {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
    </div>
  );
}

import { AlertTriangle, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QueueCountsEntry } from "@/server/admin/ops";

// Presentational per-queue stat card for /admin/system (doc 19). Shows the six BullMQ counts
// in a compact grid. When `counts` is null (Redis down / queue errored) it renders a red
// "Queue backend unavailable" state instead of crashing.

const STATS: { key: keyof NonNullable<QueueCountsEntry["counts"]>; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "waiting", label: "Waiting" },
  { key: "delayed", label: "Delayed" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "paused", label: "Paused" },
];

export function QueueCard({ entry }: { entry: QueueCountsEntry }) {
  const { name, counts } = entry;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold capitalize">{name}</span>
        </div>

        {counts ? (
          <div className="grid grid-cols-3 gap-2">
            {STATS.map((s) => (
              <div
                key={s.key}
                className={cn(
                  "glass flex flex-col gap-0.5 rounded-lg border border-border/40 px-2.5 py-2",
                  s.key === "failed" && counts.failed > 0 && "border-status-failed/40",
                )}
              >
                <span
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    s.key === "failed" && counts.failed > 0 && "text-status-failed",
                  )}
                >
                  {counts[s.key]}
                </span>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-status-failed/30 bg-status-failed/10 px-3 py-2.5 text-xs text-status-failed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Queue backend unavailable
              {entry.error ? <span className="block opacity-80">{entry.error}</span> : null}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

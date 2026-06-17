import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DependencyHealth } from "@/server/admin/ops";

// Presentational dependency-health tile for /admin/system (doc 19). Green when the probe is
// "ok", red when "error" - with the measured latency in ms. Keeps the System page tidy.

export function HealthTile({
  icon: Icon,
  label,
  health,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  health: DependencyHealth;
}) {
  const ok = health.status === "ok";
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              ok ? "bg-status-posted/10 text-status-posted" : "bg-status-failed/10 text-status-failed",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              ok
                ? "bg-status-posted/10 text-status-posted ring-status-posted/25"
                : "bg-status-failed/10 text-status-failed ring-status-failed/25",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                ok ? "bg-status-posted" : "bg-status-failed",
              )}
            />
            {ok ? "Online" : "Down"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {health.latencyMs}
            <span className="ml-1 text-base font-normal text-muted-foreground">ms</span>
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

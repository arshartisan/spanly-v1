"use client";

import { CalendarClock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComposerAction = "draft" | "now" | "schedule" | "queue";

const QUICK_TIMES = ["11:00", "15:00", "19:00"];

/** Right-hand schedule card (doc 01/06): post-now vs schedule (pick-a-time / add-to-queue). */
export function ScheduleCard({
  scheduleOn,
  setScheduleOn,
  scheduleTab,
  setScheduleTab,
  date,
  setDate,
  time,
  setTime,
  submitEnabled,
  submitting,
  onAction,
  disabledReason,
}: {
  scheduleOn: boolean;
  setScheduleOn: (v: boolean) => void;
  scheduleTab: "time" | "queue";
  setScheduleTab: (v: "time" | "queue") => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  submitEnabled: boolean;
  submitting: ComposerAction | null;
  onAction: (action: ComposerAction) => void;
  disabledReason: string | null;
}) {
  const busy = submitting !== null;
  const scheduleReady = scheduleTab === "queue" || (date !== "" && time !== "");

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Schedule post</span>
        <button
          type="button"
          role="switch"
          aria-checked={scheduleOn}
          onClick={() => setScheduleOn(!scheduleOn)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            scheduleOn ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
              scheduleOn ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      </div>

      {!scheduleOn ? (
        <Button
          className="w-full"
          disabled={!submitEnabled || busy}
          onClick={() => onAction("now")}
        >
          {submitting === "now" ? <Loader2 className="animate-spin" /> : <Send />}
          Post now
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            {(["time", "queue"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setScheduleTab(t)}
                className={cn(
                  "rounded-md py-1.5 font-medium transition-colors",
                  scheduleTab === t ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                {t === "time" ? "Pick a time" : "Add to queue"}
              </button>
            ))}
          </div>

          {scheduleTab === "time" ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                {QUICK_TIMES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTime(q)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
                      time === q && "border-primary text-primary",
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Your post will be posted at {time || "HH:MM"} in your local time.
              </p>
              <Button
                className="w-full"
                disabled={!submitEnabled || !scheduleReady || busy}
                onClick={() => onAction("schedule")}
              >
                {submitting === "schedule" ? <Loader2 className="animate-spin" /> : <CalendarClock />}
                Schedule
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Drops into your next open queue slot (configured in Settings → Queue).
              </p>
              <Button
                className="w-full"
                disabled={!submitEnabled || busy}
                onClick={() => onAction("queue")}
              >
                {submitting === "queue" ? <Loader2 className="animate-spin" /> : <CalendarClock />}
                Add to queue
              </Button>
            </div>
          )}
        </>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={() => onAction("draft")}
      >
        {submitting === "draft" ? <Loader2 className="animate-spin" /> : null}
        Save to Drafts
      </Button>

      {!submitEnabled && disabledReason && (
        <p className="text-center text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  );
}

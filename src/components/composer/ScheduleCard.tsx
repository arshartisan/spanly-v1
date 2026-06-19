"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarDays, Clock, Loader2, Send } from "lucide-react";
import { format, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ComposerAction = "draft" | "now" | "schedule" | "queue";

const QUICK_TIMES = ["11:00", "15:00", "19:00"];

/** 15-minute time options as { value: "HH:MM" (24h), label: "h:MM AM/PM" }. */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = String((i % 4) * 15).padStart(2, "0");
  const value = `${String(h).padStart(2, "0")}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${h12}:${m} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

/** Minutes-since-midnight for an "HH:MM" value. */
function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" ⇄ local Date, kept TZ-safe (no UTC shift). */
function parseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeLabel(value: string): string {
  return TIME_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

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

  const selectedDate = parseDate(date);

  // Current local time, set after mount (avoids SSR/hydration drift) and refreshed each minute
  // so options re-enable/disable as the clock advances. Null until mounted → nothing disabled.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isToday =
    !!selectedDate &&
    !!now &&
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();

  /** A time slot is in the past only when the selected date is today and it's at/before now. */
  function isTimePast(value: string): boolean {
    if (!isToday || !now) return false;
    return toMinutes(value) <= now.getHours() * 60 + now.getMinutes();
  }

  const timeIsPast = scheduleTab === "time" && date !== "" && time !== "" && isTimePast(time);
  const scheduleReady =
    scheduleTab === "queue" || (date !== "" && time !== "" && !timeIsPast);

  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-4">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => d && setDate(formatDate(d))}
                      disabled={{ before: startOfToday() }}
                      defaultMonth={selectedDate}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>

                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="w-[124px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Time">{timeLabel(time)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} disabled={isTimePast(t.value)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {QUICK_TIMES.map((q) => {
                  const past = isTimePast(q);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setTime(q)}
                      disabled={past}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
                        time === q && !past && "border-primary text-primary",
                        past && "cursor-not-allowed opacity-40 hover:bg-transparent",
                      )}
                    >
                      {timeLabel(q)}
                    </button>
                  );
                })}
              </div>
              {timeIsPast ? (
                <p className="text-xs text-destructive">
                  That time has already passed today. Pick a later time.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your post will be posted at {time ? timeLabel(time) : "HH:MM"} in your local time.
                </p>
              )}
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

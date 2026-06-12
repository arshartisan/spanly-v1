"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { QueueView } from "@/server/settings";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Queue tab (doc 11B). Grid of weekly posting slots (times × days) that power "Add to queue"
// (doc 08). Edits here don't affect already-scheduled posts. Replace-on-save semantics.
export function QueuePanel({ initial }: { initial: QueueView }) {
  const [slots, setSlots] = useState(initial.slots);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [randomize, setRandomize] = useState(initial.randomizeWithinMinutes > 0);
  const [newTime, setNewTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => {
    const list =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
    return list.includes(timezone) ? list : [timezone, ...list];
  }, [timezone]);

  function addTime() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) return;
    if (slots.some((s) => s.time === newTime)) return;
    setSlots((prev) =>
      [...prev, { time: newTime, days: [true, true, true, true, true, false, false] }].sort((a, b) =>
        a.time.localeCompare(b.time),
      ),
    );
  }

  function toggleDay(time: string, day: number) {
    setSlots((prev) =>
      prev.map((s) => (s.time === time ? { ...s, days: s.days.map((d, i) => (i === day ? !d : d)) } : s)),
    );
  }

  function removeSlot(time: string) {
    setSlots((prev) => prev.filter((s) => s.time !== time));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/queue", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone,
        randomizeWithinMinutes: randomize ? 10 : 0,
        slots: slots.filter((s) => s.days.some(Boolean)),
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      if (data?.queue) setSlots(data.queue.slots);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      setError(data?.error ?? "Could not save queue.");
    }
  }

  const slotCount = slots.filter((s) => s.days.some(Boolean)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-background p-5">
        <p className="text-sm">
          You have <span className="font-semibold">{slotCount}</span> posting time
          {slotCount === 1 ? "" : "s"} during your week. Editing here won't affect already
          scheduled posts.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Timezone: {timezone}</p>
      </div>

      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 text-sm font-semibold">Posting schedule</h2>

        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots yet. Add a time below.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[80px_repeat(7,1fr)_32px] items-center gap-1 text-center text-xs text-muted-foreground">
              <span />
              {DAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
              <span />
            </div>
            {slots.map((slot) => (
              <div
                key={slot.time}
                className="grid grid-cols-[80px_repeat(7,1fr)_32px] items-center gap-1"
              >
                <span className="text-sm font-medium tabular-nums">{label12(slot.time)}</span>
                {slot.days.map((on, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(slot.time, i)}
                    className={cn(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                    aria-pressed={on}
                  >
                    {on ? "✓" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => removeSlot(slot.time)}
                  className="mx-auto text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${slot.time}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-32"
          />
          <Button variant="outline" size="sm" onClick={addTime}>
            <Plus className="mr-1 h-4 w-4" /> Add time
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Randomize posting time</p>
            <p className="text-xs text-muted-foreground">Vary each post by up to 10 minutes.</p>
          </div>
          <Switch checked={randomize} onCheckedChange={setRandomize} />
        </div>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <label htmlFor="tz" className="text-sm font-medium">
          Timezone
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Authoritative for slot times (overrides your profile timezone for the queue).
        </p>
        <select
          id="tz"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save queue
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}

/** "11:00" → "11:00 am". */
function label12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

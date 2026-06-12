"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Download, FileUp, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import {
  BULK_MODES,
  SAMPLE_CSV,
  type BulkCommitResult,
  type BulkMode,
  type BulkPreview,
} from "@/lib/schemas/bulk";
import type { BulkAccount } from "@/server/bulk";

const MODE_LABELS: Record<BulkMode, { title: string; hint: string }> = {
  draft: { title: "Save as drafts", hint: "Create drafts to finish later. Date/time ignored." },
  schedule: { title: "Schedule", hint: "Each row needs a date + time in your timezone." },
  queue: { title: "Add to queue", hint: "Fill your next open queue slots in order." },
};

export function BulkImportView({
  accounts,
  timezone,
}: {
  accounts: BulkAccount[];
  timezone: string;
}) {
  const [mode, setMode] = useState<BulkMode>("draft");
  const [defaults, setDefaults] = useState<Set<string>>(new Set());
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [result, setResult] = useState<BulkCommitResult | null>(null);
  const [busy, setBusy] = useState<"validate" | "commit" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleDefault(id: string) {
    setDefaults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onFile(file: File) {
    setCsv(await file.text());
    setPreview(null);
    setResult(null);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spanly-bulk-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function validate() {
    setBusy("validate");
    setResult(null);
    const res = await fetch("/api/bulk/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, mode, defaultAccountIds: [...defaults] }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (res.ok) setPreview(data);
  }

  async function commit() {
    setBusy("commit");
    const res = await fetch("/api/bulk/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, mode, defaultAccountIds: [...defaults] }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (res.ok) {
      setResult(data);
      setPreview(null);
    }
  }

  const validCount = preview?.summary.valid ?? 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Import</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload a CSV to create many posts at once. Columns:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              caption, type, platforms, date, time, media_url
            </code>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample}>
          <Download className="mr-1 h-4 w-4" /> Sample CSV
        </Button>
      </div>

      {/* Step 1 — default accounts */}
      <section className="rounded-xl border bg-background p-5">
        <h2 className="text-sm font-semibold">Default accounts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used for rows that leave the <code className="rounded bg-muted px-1">platforms</code>{" "}
          column empty.
        </p>
        {accounts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No connected accounts.{" "}
            <Link href="/connections" className="text-primary underline">
              Connect an account
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((a) => {
              const on = defaults.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleDefault(a.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    on ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                  <span className="font-medium">{a.label}</span>
                  <span className="text-xs text-muted-foreground">@{a.handle}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Step 2 — mode */}
      <section className="rounded-xl border bg-background p-5">
        <h2 className="text-sm font-semibold">What to do with each row</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BULK_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border p-3 text-left transition ${
                mode === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:bg-muted"
              }`}
            >
              <p className="text-sm font-medium">{MODE_LABELS[m].title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{MODE_LABELS[m].hint}</p>
            </button>
          ))}
        </div>
        {mode === "schedule" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Times are interpreted in <span className="font-medium">{timezone}</span>.
          </p>
        )}
      </section>

      {/* Step 3 — CSV */}
      <section className="rounded-xl border bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">CSV data</h2>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-1 h-4 w-4" /> Upload file
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCsv(SAMPLE_CSV);
                setPreview(null);
                setResult(null);
              }}
            >
              Load sample
            </Button>
          </div>
        </div>
        <Textarea
          className="mt-3 min-h-40 font-mono text-xs"
          placeholder="caption,type,platforms,date,time,media_url&#10;&quot;Hello world&quot;,text,&quot;x,linkedin&quot;,,,"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
            setResult(null);
          }}
        />
        <div className="mt-3 flex items-center gap-2">
          <Button disabled={!csv.trim() || busy !== null} onClick={validate}>
            {busy === "validate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-1 h-4 w-4" /> Validate
          </Button>
          {preview && (
            <Button
              variant="default"
              disabled={validCount === 0 || busy !== null}
              onClick={commit}
            >
              {busy === "commit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {validCount} {validCount === 1 ? "post" : "posts"}
            </Button>
          )}
        </div>
      </section>

      {preview && <PreviewTable preview={preview} />}
      {result && <ResultPanel result={result} />}
    </div>
  );
}

function PreviewTable({ preview }: { preview: BulkPreview }) {
  const { summary, rows } = preview;
  return (
    <section className="rounded-xl border bg-background">
      <div className="flex items-center gap-3 border-b p-4">
        <h2 className="text-sm font-semibold">Preview</h2>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5">{summary.total} rows</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">{summary.valid} valid</span>
          {summary.invalid > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">{summary.invalid} invalid</span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 font-medium">#</th>
              <th className="p-3 font-medium">Caption</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Platforms</th>
              <th className="p-3 font-medium">When</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ok = r.errors.length === 0;
              return (
                <tr key={r.index} className={`border-b align-top ${ok ? "" : "bg-red-50/40"}`}>
                  <td className="p-3 text-xs text-muted-foreground">{r.index}</td>
                  <td className="max-w-xs p-3">
                    <p className="truncate">{r.caption || <span className="text-muted-foreground">—</span>}</p>
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.type}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {r.platforms.length > 0
                      ? r.platforms.map((p) => PLATFORM_CONFIG[p].label).join(", ")
                      : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.publishAtIso ? formatWhen(r.publishAtIso, preview.timezone) : preview.mode}
                  </td>
                  <td className="p-3">
                    {ok ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <Check className="h-3.5 w-3.5" /> Ready
                      </span>
                    ) : (
                      <ul className="space-y-0.5">
                        {r.errors.map((e, i) => (
                          <li key={i} className="flex items-start gap-1 text-xs text-red-700">
                            <X className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.warnings.map((w, i) => (
                      <p key={i} className="mt-0.5 flex items-start gap-1 text-xs text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultPanel({ result }: { result: BulkCommitResult }) {
  const failures = result.rows.filter((r) => !r.ok);
  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Check className="h-4 w-4 text-primary" /> Import complete
      </h2>
      <p className="mt-1 text-sm">
        Created <span className="font-medium">{result.created}</span> of {result.attempted} posts
        {result.failed > 0 && <span className="text-red-700"> · {result.failed} failed</span>}.
      </p>
      {failures.length > 0 && (
        <ul className="mt-3 space-y-1">
          {failures.map((f) => (
            <li key={f.index} className="text-xs text-red-700">
              Row {f.index}: {f.error}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <Button asChild size="sm">
          <Link href="/posts/all">View posts</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/calendar">Open calendar</Link>
        </Button>
      </div>
    </section>
  );
}

function formatWhen(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Retry + Remove actions for a row on the failed-job list (doc 19). Each posts to its
// control route and router.refresh()es the RSC on success, surfacing an inline error.
// Mirrors <ForceDisconnect/> / <ContentModeration/>. Only rendered when the viewer is an
// admin (canControl gating happens on the page).

async function post(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? "Action failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export function JobActions({
  queue,
  jobId,
}: {
  queue: string;
  jobId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"retry" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "retry" | "remove") {
    setError(null);
    setPending(action);
    const result = await post(
      `/api/admin/system/jobs/${queue}/${encodeURIComponent(jobId)}/${action}`,
    );
    setPending(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => run("retry")}
        >
          {pending === "retry" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Retry
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => run("remove")}
          className="border-status-failed/40 text-status-failed hover:bg-status-failed/10 hover:text-status-failed"
        >
          {pending === "remove" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Remove
        </Button>
      </div>
      {error ? <p className="text-[11px] text-status-failed">{error}</p> : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PlusCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultCard } from "./ResultCard";
import { isTerminal, type PublishingStateView } from "./types";

const POLL_MS = 2000;

/**
 * Publishing progress + results (doc 09). Polls GET /api/posts/:id every 2s until the post
 * reaches a terminal status, then renders per-target result cards with retry.
 */
export function PublishingView({ initial }: { initial: PublishingStateView }) {
  const [state, setState] = useState<PublishingStateView>(initial);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryAllBusy, setRetryAllBusy] = useState(false);
  const stopped = useRef(isTerminal(initial.status));

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/posts/${initial.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as PublishingStateView;
    setState(next);
    if (isTerminal(next.status)) stopped.current = true;
  }, [initial.id]);

  // Poll while non-terminal. A separate `tick` guard keeps the interval from stacking refreshes.
  useEffect(() => {
    if (stopped.current) return;
    let active = true;
    const timer = setInterval(async () => {
      if (!active || stopped.current) return;
      await refresh();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const retryOne = useCallback(
    async (targetId: string) => {
      setRetrying((s) => new Set(s).add(targetId));
      try {
        await fetch(`/api/posts/${initial.id}/targets/${targetId}/retry`, { method: "POST" });
        stopped.current = false;
        await refresh();
      } finally {
        setRetrying((s) => {
          const n = new Set(s);
          n.delete(targetId);
          return n;
        });
      }
    },
    [initial.id, refresh],
  );

  const retryAll = useCallback(async () => {
    setRetryAllBusy(true);
    try {
      await fetch(`/api/posts/${initial.id}/retry-all`, { method: "POST" });
      stopped.current = false;
      await refresh();
    } finally {
      setRetryAllBusy(false);
    }
  }, [initial.id, refresh]);

  const total = state.targets.length;
  const succeeded = state.targets.filter((t) => t.status === "success").length;
  const failed = state.targets.filter((t) => t.status === "failed").length;
  const done = isTerminal(state.status);
  const allFailed = done && total > 0 && succeeded === 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 md:p-8">
      <Header done={done} succeeded={succeeded} failed={failed} total={total} />

      <div className="flex flex-col gap-3">
        {state.targets.map((t) => (
          <ResultCard key={t.id} target={t} onRetry={retryOne} retrying={retrying.has(t.id)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {allFailed && (
          <Button onClick={retryAll} disabled={retryAllBusy} variant="outline">
            {retryAllBusy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Retry all
          </Button>
        )}
        <Button asChild variant={done ? "default" : "outline"}>
          <Link href={`/create/${state.type}`}>
            <PlusCircle />
            Create another post
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/posts/all">Go to posts</Link>
        </Button>
      </div>
    </div>
  );
}

function Header({
  done,
  succeeded,
  failed,
  total,
}: {
  done: boolean;
  succeeded: number;
  failed: number;
  total: number;
}) {
  if (!done) {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Publishing your post…</h1>
          <p className="text-sm text-muted-foreground">
            {succeeded} of {total} published. You can leave this page — it keeps publishing.
          </p>
        </div>
      </div>
    );
  }
  const allOk = failed === 0;
  return (
    <div className="flex items-center gap-3">
      {allOk ? (
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      ) : (
        <XCircle className="h-6 w-6 text-destructive" />
      )}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {allOk ? "Published" : "Some posts failed"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Published to {succeeded} of {total} account{total === 1 ? "" : "s"}.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { CheckCircle2, ExternalLink, Info, Loader2, RotateCcw, XCircle } from "lucide-react";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { snippet } from "@/lib/post-display";
import { humanizePublishError } from "@/lib/publish-error";
import { cn } from "@/lib/utils";
import type { PublishingTargetView } from "./types";

const STATUS_LABEL: Record<PublishingTargetView["status"], string> = {
  pending: "Queued",
  publishing: "Publishing…",
  success: "Success",
  failed: "Failed",
};

/** One per-target result card on the publishing screen (doc 09). */
export function ResultCard({
  target,
  onRetry,
  retrying,
}: {
  target: PublishingTargetView;
  onRetry: (targetId: string) => void;
  retrying: boolean;
}) {
  const style = PLATFORM_STYLE[target.platform];
  const Icon = style.Icon;
  const failure = target.status === "failed" ? humanizePublishError(target.error) : null;
  // Expired/revoked connections get a Reconnect path; everything else offers Retry.
  const isAuthError = failure?.kind === "auth";

  return (
    <div
      className={cn(
        "glass flex flex-col gap-3 rounded-2xl p-4",
        target.status === "failed" && "border-destructive/40",
        target.status === "success" && "border-emerald-500/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: style.color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">{target.handle}</p>
            <p className="text-xs text-muted-foreground">{style.label}</p>
          </div>
        </div>
        <StatusBadge status={target.status} />
      </div>

      {target.caption.trim() && (
        <p className="text-sm text-foreground/80">{snippet(target.caption, 160)}</p>
      )}

      {target.status === "success" && target.externalUrl && (
        <a
          href={target.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View post
        </a>
      )}

      {target.status === "failed" && failure && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg bg-destructive/10 px-3 py-2.5">
            <p className="text-sm font-medium text-destructive">{failure.message}</p>
            {failure.hint && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive/80">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{failure.hint}</span>
              </p>
            )}
            {failure.raw && failure.raw !== failure.message && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-foreground/5 p-2 font-mono text-[11px] leading-relaxed">
                  {failure.raw}
                </pre>
              </details>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAuthError ? (
              <Link
                href="/connections"
                className="press inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Reconnect account
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onRetry(target.id)}
                disabled={retrying}
                className="press inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {failure.kind === "permission" ? "Retry anyway" : "Retry"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PublishingTargetView["status"] }) {
  const map = {
    pending: { cls: "bg-muted text-muted-foreground", icon: Loader2, spin: false },
    publishing: { cls: "bg-indigo-500/10 text-indigo-600", icon: Loader2, spin: true },
    success: { cls: "bg-emerald-500/10 text-emerald-700", icon: CheckCircle2, spin: false },
    failed: { cls: "bg-destructive/10 text-destructive", icon: XCircle, spin: false },
  } as const;
  const { cls, icon: Icon, spin } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cls)}>
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

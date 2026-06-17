import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, ListChecks } from "lucide-react";
import {
  listJobs,
  AdminActionError,
  type JobDto,
  type JobState,
} from "@/server/admin/ops";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { jobListQuerySchema } from "@/lib/schemas/admin-ops";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { JobsFilters } from "@/components/admin/system/JobsFilters";
import { JobActions } from "@/components/admin/system/JobActions";
import { cn } from "@/lib/utils";

// Admin failed/active job list (doc 19) - RSC + client actions. Lenient-parses queue+state
// from the URL, then calls listJobs() INSIDE a try/catch: a Redis-down 503 renders an error
// panel ("Queue backend unavailable") instead of crashing the page. Admins get Retry/Remove.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSystemJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireStaff();
  const canControl = roleAtLeast(viewer.role, "admin");
  const raw = await searchParams;

  // Lenient parse: fall back to the defaults (publish/failed) rather than 500 the page.
  const parsed = jobListQuerySchema.safeParse({
    queue: first(raw.queue),
    state: first(raw.state),
  });
  const filter = parsed.success
    ? parsed.data
    : jobListQuerySchema.parse({ queue: "publish" });

  let jobs: JobDto[] | null = null;
  let queueDown = false;
  let errorMessage: string | null = null;
  try {
    const result = await listJobs(filter);
    jobs = result.jobs;
  } catch (err) {
    if (err instanceof AdminActionError && err.status === 503) {
      queueDown = true;
    } else if (err instanceof AdminActionError) {
      errorMessage = err.message;
    } else {
      errorMessage = "Could not load jobs.";
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <Link
          href="/admin/system"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to system
        </Link>
      </Reveal>

      <Reveal delay={0.04}>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Inspect a queue&apos;s jobs and retry or remove the failures.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <JobsFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {queueDown ? (
          <ErrorPanel>Queue backend unavailable - is Redis running?</ErrorPanel>
        ) : errorMessage ? (
          <ErrorPanel>{errorMessage}</ErrorPanel>
        ) : jobs && jobs.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>Job</Th>
                    <Th>Attempts</Th>
                    <Th>Failed reason</Th>
                    <Th>Created</Th>
                    <Th>Finished</Th>
                    {canControl ? <Th className="text-right">Actions</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id ?? `${job.name}-${job.timestamp}`}
                      job={job}
                      queue={filter.queue}
                      canControl={canControl}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState state={filter.state} />
        )}
      </Reveal>
    </div>
  );
}

function JobRow({
  job,
  queue,
  canControl,
}: {
  job: JobDto;
  queue: string;
  canControl: boolean;
}) {
  const target = job.data.targetId ?? job.data.task ?? null;
  return (
    <tr className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{job.name}</span>
          <span className="font-mono text-xs text-muted-foreground">#{job.id ?? "-"}</span>
          {target ? (
            <span className="truncate font-mono text-[11px] text-muted-foreground/80">
              {target}
            </span>
          ) : null}
        </div>
      </Td>
      <Td className="tabular-nums text-muted-foreground">{job.attemptsMade}</Td>
      <Td className="max-w-[320px]">
        {job.failedReason ? (
          <span className="line-clamp-2 text-status-failed/90">{job.failedReason}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">{fmtTs(job.timestamp)}</Td>
      <Td className="whitespace-nowrap text-muted-foreground">{fmtTs(job.finishedOn)}</Td>
      {canControl ? (
        <Td className="text-right">
          {job.id ? (
            <JobActions queue={queue} jobId={job.id} />
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </Td>
      ) : null}
    </tr>
  );
}

function fmtTs(ms: number | null): string {
  return ms ? format(new Date(ms), "d MMM yyyy, HH:mm") : "-";
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function ErrorPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-3 text-sm text-status-failed">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}

function EmptyState({ state }: { state: JobState }) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ListChecks className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No {state} jobs</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This queue has no jobs in the {state} state right now.
          </p>
        </div>
      </div>
    </Card>
  );
}

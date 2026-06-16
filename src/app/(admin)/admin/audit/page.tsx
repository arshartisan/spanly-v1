import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ScrollText } from "lucide-react";
import { listAuditLogs, type AuditLogEntry } from "@/server/admin/audit-log";
import { requireStaff } from "@/server/admin/access";
import { auditLogQuerySchema } from "@/lib/schemas/admin-audit";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { AuditFilters } from "@/components/admin/audit/AuditFilters";
import { cn } from "@/lib/utils";

// Admin audit log (doc 15) — RSC, append-only READ surface. Lenient-parses the filters,
// reads via listAuditLogs(), and renders the glass table with a cursor "Load more" link
// (mirrors the system events log). Every staff mutation across the app lands here.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireStaff();
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = auditLogQuerySchema.safeParse({
    action: first(raw.action),
    actorId: first(raw.actorId),
    actorQuery: first(raw.actorQuery),
    targetType: first(raw.targetType),
    targetId: first(raw.targetId),
    from: first(raw.from),
    to: first(raw.to),
    cursor: first(raw.cursor),
    take: first(raw.take),
  });
  const filter = parsed.success ? parsed.data : auditLogQuerySchema.parse({});

  const { entries, nextCursor } = await listAuditLogs(filter);

  // Build the "Load more" href: carry filters forward + the new cursor (mirrors content list).
  const loadMoreParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== "cursor") loadMoreParams.set(key, v);
  }
  if (nextCursor) loadMoreParams.set("cursor", nextCursor);
  const loadMoreHref = `/admin/audit?${loadMoreParams.toString()}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Every staff action, append-only.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <AuditFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>When</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>Metadata</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>

      {nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={loadMoreHref}
            className="press glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Load more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr className="border-b border-border/40 align-top transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td className="whitespace-nowrap text-muted-foreground">
        {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm")}
      </Td>
      <Td className="max-w-[200px]">
        <Link
          href={`/admin/users/${entry.actor.id}`}
          className="group flex flex-col gap-0.5"
        >
          <span className="line-clamp-1 font-medium transition-colors group-hover:text-primary">
            {entry.actor.email}
          </span>
          {entry.actor.displayName ? (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {entry.actor.displayName}
            </span>
          ) : null}
        </Link>
      </Td>
      <Td>
        <span className="inline-flex items-center rounded-md bg-foreground/[0.06] px-2 py-0.5 font-mono text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
          {entry.action}
        </span>
      </Td>
      <Td className="max-w-[200px]">
        <TargetCell targetType={entry.targetType} targetId={entry.targetId} />
      </Td>
      <Td className="max-w-[280px]">
        <MetadataCell metadata={entry.metadata} />
      </Td>
      <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {entry.ip ?? "—"}
      </Td>
    </tr>
  );
}

function TargetCell({
  targetType,
  targetId,
}: {
  targetType: string | null;
  targetId: string | null;
}) {
  if (!targetType && !targetId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const shortId = targetId ? `${targetId.slice(0, 10)}${targetId.length > 10 ? "…" : ""}` : null;
  const body = (
    <span className="flex flex-col gap-0.5">
      {targetType ? <span className="text-xs font-medium">{targetType}</span> : null}
      {shortId ? (
        <span className="line-clamp-1 font-mono text-xs text-muted-foreground">{shortId}</span>
      ) : null}
    </span>
  );

  // Link "user" targets to the user detail page; everything else renders inline.
  if (targetType === "user" && targetId) {
    return (
      <Link
        href={`/admin/users/${targetId}`}
        className="transition-colors hover:text-primary"
      >
        {body}
      </Link>
    );
  }
  return body;
}

/**
 * Render the metadata JSON compactly. We NEVER assume any particular shape or PII — just
 * stringify the (small) object. A `<details>` keeps long payloads from blowing out the row.
 */
function MetadataCell({ metadata }: { metadata: AuditLogEntry["metadata"] }) {
  const isEmpty =
    metadata == null ||
    (typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      Object.keys(metadata).length === 0);

  if (isEmpty) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const json = JSON.stringify(metadata);
  const compact = json.length > 80 ? `${json.slice(0, 80)}…` : json;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="line-clamp-1 group-open:hidden">{compact}</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-foreground/[0.04] p-2 font-mono text-[11px] text-foreground/80">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ScrollText className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No audit entries</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No staff actions match this filter yet.
          </p>
        </div>
      </div>
    </Card>
  );
}

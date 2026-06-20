import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Activity } from "lucide-react";
import {
  listWebhookEvents,
  type WebhookEventItem,
} from "@/server/admin/ops";
import { requireStaff } from "@/server/admin/access";
import { webhookEventQuerySchema } from "@/lib/schemas/admin-ops";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { EventFilters } from "@/components/admin/system/EventFilters";
import { cn } from "@/lib/utils";

// Admin webhook/Polar event log (doc 19) - RSC. Lenient-parses the source filter, reads via
// listWebhookEvents(), and renders the glass table with a cursor "Load more" link (mirrors the
// content list). Status renders as a badge: received/processed/delivered = ok-ish, failed = red.

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSystemEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireStaff();
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = webhookEventQuerySchema.safeParse({
    source: first(raw.source),
    cursor: first(raw.cursor),
    take: first(raw.take),
  });
  const filter = parsed.success ? parsed.data : webhookEventQuerySchema.parse({});

  const { events, nextCursor } = await listWebhookEvents(filter);

  // Build the "Load more" href: carry filters forward + the new cursor (mirrors content list).
  const loadMoreParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== "cursor") loadMoreParams.set(key, v);
  }
  if (nextCursor) loadMoreParams.set("cursor", nextCursor);
  const loadMoreHref = `/admin/system/events?${loadMoreParams.toString()}`;

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
        <h1 className="text-2xl font-semibold tracking-tight">Event log</h1>
        <p className="text-sm text-muted-foreground">
          Inbound Polar webhooks and outbound user-webhook deliveries.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <EventFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>Source</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Ref</Th>
                    <Th>Attempts</Th>
                    <Th>Error</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
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

const SOURCE_LABEL: Record<string, string> = {
  polar: "Polar",
  user_webhook: "User webhook",
};

function EventRow({ event }: { event: WebhookEventItem }) {
  return (
    <tr className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td className="whitespace-nowrap font-medium">
        {SOURCE_LABEL[event.source] ?? event.source}
      </Td>
      <Td className="whitespace-nowrap font-mono text-xs text-foreground/80">{event.type}</Td>
      <Td>
        <EventStatusBadge status={event.status} />
      </Td>
      <Td className="max-w-[180px]">
        {event.refId ? (
          <span className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {event.refId}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Td>
      <Td className="tabular-nums text-muted-foreground">{event.attempts}</Td>
      <Td className="max-w-[280px]">
        {event.error ? (
          <span className="line-clamp-2 text-status-failed/90">{event.error}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {format(new Date(event.createdAt), "d MMM yyyy, HH:mm")}
      </Td>
    </tr>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const failed = status === "failed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        failed
          ? "bg-status-failed/10 text-status-failed ring-status-failed/25"
          : "bg-status-posted/10 text-status-posted ring-status-posted/25",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          failed ? "bg-status-failed" : "bg-status-posted",
        )}
      />
      {status}
    </span>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No events</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No webhook events match this filter yet.
          </p>
        </div>
      </div>
    </Card>
  );
}

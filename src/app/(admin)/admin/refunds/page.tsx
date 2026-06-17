import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { RotateCcw } from "lucide-react";
import { RefundStatus } from "@prisma/client";
import {
  listRefundRequests,
  type AdminRefundListItem,
} from "@/server/admin/billing";
import { requireStaff } from "@/server/admin/access";
import { roleAtLeast } from "@/server/admin/access";
import { refundStatusFilterSchema } from "@/lib/schemas/admin-billing";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { RefundActions } from "@/components/admin/billing/RefundActions";
import { formatCents } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

// Admin refund-request queue (doc 17) - RSC. Defaults to the pending queue; staff can
// approve/deny pending rows. Out-of-policy rows (>7 days old) are flagged in red.

export const dynamic = "force-dynamic";

const REFUND_WINDOW_DAYS = 7;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_TABS: { value: RefundStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "refunded", label: "Refunded" },
  { value: "denied", label: "Denied" },
  { value: "all", label: "All" },
];

const REFUND_STATUS_BADGE: Record<RefundStatus, string> = {
  pending: "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20",
  approved: "bg-status-scheduled/10 text-status-scheduled ring-1 ring-inset ring-status-scheduled/20",
  refunded: "bg-status-posted/10 text-status-posted ring-1 ring-inset ring-status-posted/20",
  denied: "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20",
};

const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  refunded: "Refunded",
  denied: "Denied",
};

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireStaff();
  const viewerIsSuperadmin = roleAtLeast(viewer.role, "superadmin");

  const raw = await searchParams;
  const rawStatus = first(raw.status);
  // Default to the pending queue when no (or invalid) status is given.
  const parsed = refundStatusFilterSchema.safeParse({ status: rawStatus });
  const activeFilter: RefundStatus | "all" =
    rawStatus === "all" ? "all" : parsed.success && parsed.data.status ? parsed.data.status : "pending";

  const refunds = await listRefundRequests(
    activeFilter === "all" ? undefined : activeFilter,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Refund requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and action customer refund requests.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <div
          role="tablist"
          aria-label="Refund status"
          className="glass flex flex-wrap gap-1 rounded-2xl p-1"
        >
          {STATUS_TABS.map((tab) => {
            const selected = tab.value === activeFilter;
            const href =
              tab.value === "pending" ? "/admin/refunds" : `/admin/refunds?status=${tab.value}`;
            return (
              <Link
                key={tab.value}
                href={href}
                role="tab"
                aria-selected={selected}
                className={cn(
                  "press inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary/15 font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        {refunds.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>User</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Reason</Th>
                    <Th>Age</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <RefundRow
                      key={refund.id}
                      refund={refund}
                      viewerIsSuperadmin={viewerIsSuperadmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>
    </div>
  );
}

function RefundRow({
  refund,
  viewerIsSuperadmin,
}: {
  refund: AdminRefundListItem;
  viewerIsSuperadmin: boolean;
}) {
  const outOfPolicy = refund.daysSinceCreated > REFUND_WINDOW_DAYS;

  return (
    <tr className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td>
        <Link
          href={`/admin/users/${refund.user.id}`}
          className="flex min-w-0 flex-col hover:underline focus-visible:outline-none"
        >
          <span className="truncate font-medium text-foreground">{refund.user.email}</span>
          {refund.user.displayName ? (
            <span className="truncate text-xs text-muted-foreground">
              {refund.user.displayName}
            </span>
          ) : null}
        </Link>
      </Td>
      <Td className="whitespace-nowrap text-right font-medium tabular-nums">
        {formatCents(refund.amount)}
      </Td>
      <Td className="max-w-xs">
        <span className="block truncate text-foreground/90" title={refund.reason}>
          {refund.reason}
        </span>
      </Td>
      <Td className="whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-muted-foreground"
            title={format(new Date(refund.createdAt), "d MMM yyyy, HH:mm")}
          >
            {refund.daysSinceCreated === 0
              ? "Today"
              : `${refund.daysSinceCreated}d ago`}
          </span>
          {outOfPolicy ? (
            <span className="inline-flex w-fit items-center rounded-full bg-status-failed/10 px-2 py-0.5 text-[10px] font-medium text-status-failed ring-1 ring-inset ring-status-failed/30">
              Out of policy
            </span>
          ) : null}
        </div>
      </Td>
      <Td>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            REFUND_STATUS_BADGE[refund.status],
          )}
        >
          {REFUND_STATUS_LABEL[refund.status]}
        </span>
      </Td>
      <Td className="text-right">
        {refund.status === "pending" ? (
          <RefundActions requestId={refund.id} viewerIsSuperadmin={viewerIsSuperadmin} />
        ) : refund.decidedAt ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(refund.decidedAt), { addSuffix: true })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Td>
    </tr>
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
          <RotateCcw className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No refund requests</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nothing to review here. New customer refund requests will appear in this queue.
          </p>
        </div>
      </div>
    </Card>
  );
}

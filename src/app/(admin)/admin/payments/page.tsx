import { format } from "date-fns";
import { ExternalLink, Info, ReceiptText } from "lucide-react";
import { listPayments, type PaymentItem } from "@/server/admin/billing";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { formatCents } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

// Admin payments view (doc 17) — RSC. In mock billing mode there is no PayPal data, so we show
// an info banner. PayPal has no platform-wide charge feed (unlike Stripe), so per-subscriber
// payment history lives on each user's detail page; this platform view stays empty in live mode.

export const dynamic = "force-dynamic";

function statusTone(status: string): string {
  switch (status) {
    case "succeeded":
    case "paid":
      return "bg-status-posted/10 text-status-posted ring-1 ring-inset ring-status-posted/20";
    case "pending":
    case "processing":
      return "bg-status-draft/10 text-status-draft ring-1 ring-inset ring-status-draft/20";
    case "failed":
      return "bg-status-failed/10 text-status-failed ring-1 ring-inset ring-status-failed/20";
    default:
      return "bg-foreground/5 text-muted-foreground ring-1 ring-inset ring-border/60";
  }
}

export default async function AdminPaymentsPage() {
  const { mockMode, payments } = await listPayments();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Per-subscriber payment history from PayPal — view it on a user&apos;s detail page.
        </p>
      </Reveal>

      {mockMode ? (
        <Reveal delay={0.06}>
          <div className="glass flex items-start gap-3 rounded-2xl border border-status-draft/30 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-draft" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Mock billing mode</p>
              <p className="text-sm text-muted-foreground">
                No PayPal payment data. Set{" "}
                <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">
                  BILLING_MODE=live
                </code>{" "}
                to see invoices and charges.
              </p>
            </div>
          </div>
        </Reveal>
      ) : payments.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState />
        </Reveal>
      ) : (
        <Reveal delay={0.06}>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Transaction</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      )}
    </div>
  );
}

function PaymentRow({ payment }: { payment: PaymentItem }) {
  return (
    <tr className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td className="whitespace-nowrap text-right font-medium tabular-nums">
        {formatCents(payment.amount, payment.currency)}
      </Td>
      <Td>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
            statusTone(payment.status),
          )}
        >
          {payment.status}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {format(new Date(payment.created * 1000), "d MMM yyyy, HH:mm")}
      </Td>
      <Td className="max-w-sm">
        <span className="block truncate text-foreground/90" title={payment.description ?? undefined}>
          {payment.description ?? <span className="text-muted-foreground">—</span>}
        </span>
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-3">
          {payment.receiptUrl ? (
            <a
              href={payment.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Receipt
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground" title={payment.id}>
            {payment.id.slice(0, 16)}…
          </span>
        </div>
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
          <ReceiptText className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No payments yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No platform-wide charge feed in PayPal — see a user&apos;s detail page for their payments.
          </p>
        </div>
      </div>
    </Card>
  );
}

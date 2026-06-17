import "server-only";
import type {
  BillingInterval,
  Prisma,
  RefundRequest,
  RefundStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { isLiveBilling } from "@/server/billing-config";
import { paypalFetch } from "@/server/paypal";
import { AdminActionError } from "@/server/admin/errors";
import { PLANS, type PlanKey } from "@/server/plans";

/**
 * Admin billing service (doc 17). Wraps `src/server/billing.ts` + `src/server/paypal.ts`
 * for the staff surface: subscriptions oversight, the refund-request workflow, manual
 * overrides, credits, and a payments view. In mock mode we NEVER call PayPal —
 * refunds/overrides mutate the local rows only.
 */

/** A PayPal subscription transaction (the subset we read for refunds + the payments view). */
interface PaypalTransaction {
  id: string;
  status: string;
  time?: string;
  amount_with_breakdown?: { gross_amount?: { value?: string; currency_code?: string } };
}

/** Lookback window for PayPal subscription transaction queries (start_time is required). */
const TXN_LOOKBACK_MS = 395 * 86_400_000;

/** List a PayPal subscription's transactions over the lookback window (newest last). */
async function listSubscriptionTransactions(providerSubId: string): Promise<PaypalTransaction[]> {
  const end = new Date();
  const start = new Date(end.getTime() - TXN_LOOKBACK_MS);
  const qs = `start_time=${start.toISOString()}&end_time=${end.toISOString()}`;
  const data = await paypalFetch<{ transactions?: PaypalTransaction[] }>(
    `/v1/billing/subscriptions/${providerSubId}/transactions?${qs}`,
  );
  return data.transactions ?? [];
}

const REFUND_WINDOW_DAYS = 7;

// ─────────────────────────── Subscriptions ───────────────────────────

export interface SubscriptionFilter {
  status?: SubscriptionStatus;
  plan?: PlanKey;
  interval?: BillingInterval;
}

/**
 * Pure mapping from a parsed filter to a Prisma `SubscriptionWhereInput`. No DB calls —
 * unit-testable in isolation.
 */
export function buildSubscriptionWhere(
  filter: SubscriptionFilter,
): Prisma.SubscriptionWhereInput {
  const where: Prisma.SubscriptionWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.plan) where.plan = filter.plan;
  if (filter.interval) where.interval = filter.interval;
  return where;
}

const subSelect = {
  id: true,
  userId: true,
  plan: true,
  interval: true,
  status: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  apiAddonActive: true,
  providerCustomerId: true,
  providerSubId: true,
  providerAddonSubId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, displayName: true } },
} satisfies Prisma.SubscriptionSelect;

export type AdminSubscriptionListItem = Prisma.SubscriptionGetPayload<{
  select: typeof subSelect;
}>;

/** Subscriptions joined with safe user fields, newest first. */
export async function listSubscriptions(
  filter: SubscriptionFilter,
): Promise<AdminSubscriptionListItem[]> {
  return prisma.subscription.findMany({
    where: buildSubscriptionWhere(filter),
    select: subSelect,
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────── Refund requests ───────────────────────────

const refundSelect = {
  id: true,
  userId: true,
  subscriptionId: true,
  amount: true,
  reason: true,
  status: true,
  providerRefundId: true,
  decidedById: true,
  decidedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, displayName: true } },
} satisfies Prisma.RefundRequestSelect;

type RefundRow = Prisma.RefundRequestGetPayload<{ select: typeof refundSelect }>;

export type AdminRefundListItem = RefundRow & { daysSinceCreated: number };

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/** Refund requests + user, newest first, with a computed `daysSinceCreated`. */
export async function listRefundRequests(
  status?: RefundStatus,
): Promise<AdminRefundListItem[]> {
  const rows = await prisma.refundRequest.findMany({
    where: status ? { status } : {},
    select: refundSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ ...r, daysSinceCreated: daysSince(r.createdAt) }));
}

/** Load a refund request or throw 404. */
async function requireRefund(id: string): Promise<RefundRequest> {
  const request = await prisma.refundRequest.findUnique({ where: { id } });
  if (!request) throw new AdminActionError(404, "Refund request not found.");
  return request;
}

/** True if the request is older than the policy window from its creation. */
function isOutOfPolicy(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > REFUND_WINDOW_DAYS * 86_400_000;
}

export interface ApproveRefundOptions {
  note?: string;
  force?: boolean;
}

/**
 * Approve a pending refund and issue it. Live mode hits Stripe (latest charge → refund);
 * mock mode skips Stripe. Out-of-policy approvals require `force` (superadmin-gated at the
 * route). Returns the updated request.
 */
export async function approveRefund(
  actorId: string,
  id: string,
  opts: ApproveRefundOptions,
): Promise<RefundRequest> {
  const request = await requireRefund(id);
  if (request.status !== "pending") {
    throw new AdminActionError(409, "Refund request is not pending.");
  }

  if (isOutOfPolicy(request.createdAt) && !opts.force) {
    throw new AdminActionError(403, "Out of policy — requires force (superadmin).");
  }

  let providerRefundId: string | null = null;

  if (isLiveBilling()) {
    const sub = request.subscriptionId
      ? await prisma.subscription.findUnique({ where: { id: request.subscriptionId } })
      : await prisma.subscription.findUnique({ where: { userId: request.userId } });
    const providerSubId = sub?.providerSubId;
    if (!providerSubId) {
      throw new AdminActionError(422, "No PayPal subscription to refund.");
    }
    const txns = await listSubscriptionTransactions(providerSubId);
    const completed = txns.filter((t) => t.status === "COMPLETED");
    const txn = completed[completed.length - 1] ?? txns[txns.length - 1];
    if (!txn) {
      throw new AdminActionError(422, "No PayPal transaction to refund.");
    }
    const currency = txn.amount_with_breakdown?.gross_amount?.currency_code ?? "USD";
    // request.amount is in minor units; PayPal wants a decimal string.
    const refund = await paypalFetch<{ id: string }>(
      `/v2/payments/captures/${txn.id}/refund`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: { value: (request.amount / 100).toFixed(2), currency_code: currency },
        }),
      },
    );
    providerRefundId = refund.id;
  }

  void opts.note; // recorded by the route's audit log, not stored on the request
  return prisma.refundRequest.update({
    where: { id },
    data: {
      status: "refunded",
      providerRefundId,
      decidedById: actorId,
      decidedAt: new Date(),
    },
  });
}

/** Deny a pending refund. The note goes to audit metadata, not the row. */
export async function denyRefund(
  actorId: string,
  id: string,
  note: string,
): Promise<RefundRequest> {
  const request = await requireRefund(id);
  if (request.status !== "pending") {
    throw new AdminActionError(409, "Refund request is not pending.");
  }
  void note;
  return prisma.refundRequest.update({
    where: { id },
    data: { status: "denied", decidedById: actorId, decidedAt: new Date() },
  });
}

/** Staff-initiated pending refund request (e.g. a goodwill or off-cycle refund). */
export async function createStaffRefund(
  actorId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<RefundRequest> {
  void actorId; // recorded by the route's audit log
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AdminActionError(404, "User not found.");
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { id: true },
  });
  return prisma.refundRequest.create({
    data: {
      userId,
      subscriptionId: sub?.id ?? null,
      amount,
      reason,
      status: "pending",
    },
  });
}

// ─────────────────────────── Manual overrides ───────────────────────────

export interface SubscriptionOverridePatch {
  plan?: PlanKey;
  interval?: BillingInterval;
  status?: SubscriptionStatus;
  trialEndsAt?: Date | null;
}

/**
 * Superadmin manual subscription override. Mock-safe direct write to the local row; in
 * live mode this is an admin override that the next webhook may reconcile — that's an
 * accepted tradeoff for an exceptional, deliberate staff action. Returns the updated sub.
 */
export async function overrideSubscription(
  actorId: string,
  userId: string,
  patch: SubscriptionOverridePatch,
) {
  void actorId; // recorded by the route's audit log
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { id: true } });
  if (!sub) throw new AdminActionError(404, "Subscription not found.");

  const data: Prisma.SubscriptionUpdateInput = {};
  if (patch.plan !== undefined) data.plan = patch.plan;
  if (patch.interval !== undefined) data.interval = patch.interval;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.trialEndsAt !== undefined) data.trialEndsAt = patch.trialEndsAt;

  return prisma.subscription.update({ where: { userId }, data });
}

/**
 * Grant account credit (MVP). PayPal has no customer-balance-credit equivalent (unlike
 * Stripe), so this is a recorded no-op in both modes — the audit log at the route captures
 * actor/user/amount/reason, and any actual credit is issued out-of-band (e.g. a refund or a
 * comped period via an override). Kept with the same shape so callers don't change.
 */
export async function grantCredit(
  actorId: string,
  userId: string,
  amountCents: number,
  reason: string,
): Promise<{ ok: true }> {
  void actorId; // recorded by the route's audit log
  void userId;
  void amountCents;
  void reason;
  return { ok: true };
}

// ─────────────────────────── Payments (read) ───────────────────────────

export interface PaymentItem {
  id: string;
  amount: number; // minor units
  currency: string;
  status: string;
  description: string | null;
  created: number; // unix seconds
  customerId: string | null;
  receiptUrl: string | null;
}

export interface PaymentsResult {
  mockMode: boolean;
  payments: PaymentItem[];
}

/**
 * Recent PayPal subscription transactions for a user. Mock mode returns an empty list flagged
 * `mockMode: true` (the UI shows a mock banner). PayPal has no platform-wide charge listing
 * like Stripe, so a call without `userId` returns an empty list — the payments view is
 * per-user (reachable from a user's detail page).
 */
export async function listPayments(userId?: string): Promise<PaymentsResult> {
  if (!isLiveBilling()) {
    return { mockMode: true, payments: [] };
  }
  if (!userId) {
    return { mockMode: false, payments: [] };
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { providerSubId: true },
  });
  if (!sub?.providerSubId) return { mockMode: false, payments: [] };

  const txns = await listSubscriptionTransactions(sub.providerSubId);
  const payments: PaymentItem[] = txns.map((t) => {
    const gross = t.amount_with_breakdown?.gross_amount;
    return {
      id: t.id,
      amount: Math.round(parseFloat(gross?.value ?? "0") * 100),
      currency: (gross?.currency_code ?? "USD").toLowerCase(),
      status: t.status,
      description: null,
      created: t.time ? Math.floor(new Date(t.time).getTime() / 1000) : 0,
      customerId: null,
      receiptUrl: null,
    };
  });

  return { mockMode: false, payments };
}

// Re-export for convenience so the UI/route layer can map AdminActionError.status.
export { AdminActionError };
export { PLANS };

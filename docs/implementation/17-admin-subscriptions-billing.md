# 17 — Admin: Subscriptions, Plans & Payments

**Design refs:** `../15-admin-dashboard.md` (C — Subscriptions & Payments).
**Depends on:** `15-admin-foundation-and-access.md`, `10-billing-and-plans.md` (Stripe,
`syncSubscription`, refund policy), `01` (Subscription).
**Build phase:** Phase 9 · **Permissions:** view = `support`; refund approve/deny & plan
config = `admin`; **forced/out-of-policy refunds, manual plan/credit overrides =
`superadmin`** (defined here, but the mutating handlers are shared with Phase G).

## Scope
Oversee revenue and handle billing exceptions: a subscriptions list, a **refund-request
queue** (turning today's "record + email support" into an actionable workflow), a Stripe
payments/invoices view, a DB-backed **plan catalog**, and revenue/churn metrics. Reuses
`src/server/billing.ts` + `src/server/stripe.ts` — no new Stripe plumbing.

## Data model (deltas)
```prisma
enum RefundStatus { pending approved denied refunded }

model RefundRequest {
  id             String        @id @default(cuid())
  userId         String
  subscriptionId String?
  amount         Int           // minor units (cents)
  reason         String
  status         RefundStatus  @default(pending)
  stripeRefundId String?
  decidedById    String?
  decidedAt      DateTime?
  createdAt      DateTime      @default(now())
  @@index([status, createdAt])
}

// Plan catalog moves from hardcoded PLANS → DB rows (seeded from src/server/plans.ts):
model Plan {
  key          String  @id          // creator | growth | pro
  name         String
  monthly      Int                  // cents
  yearly       Int
  accountLimit Int                  // Infinity → store -1, treat -1 as unlimited
  features     Json
  trialDays    Int     @default(7)
  refundDays   Int     @default(7)
  active       Boolean @default(true)
  sortOrder    Int     @default(0)
}
```
> **Migration of `plans.ts`:** keep `PLANS` as the seed source. Add a `getPlans()` accessor
> in `src/server/plans.ts` that reads `Plan` rows (cached), so `accountLimit()` /
> `requirePlan()` and the customer Plans/Billing pages keep working unchanged. `-1` ⇒
> unlimited (replaces `Infinity`). The customer "Request Refund" route (doc 10) now creates
> a `RefundRequest(status=pending)` instead of only emailing support.

## Pages
```
src/app/(admin)/admin/subscriptions/page.tsx   // list + status filters — RSC
src/app/(admin)/admin/refunds/page.tsx         // refund-request queue — RSC
src/app/(admin)/admin/payments/page.tsx        // invoices/charges (Stripe) — RSC
src/app/(admin)/admin/plans/page.tsx           // plan catalog editor — RSC + client form
src/server/admin/billing.ts                    // admin billing service (wraps billing.ts)
```
- **Subscriptions** — filter by status/plan/interval; columns plan, status, trial/period
  end, MRR contribution; row links to the user (Phase B) and Stripe customer.
- **Refund queue** — pending requests with user, amount, reason, days-since-charge; actions
  **Approve & refund** / **Deny**.
- **Payments** — recent invoices & charges from Stripe (`stripe.invoices.list` /
  `charges.list` by customer or platform-wide); past-due/dunning list from
  `Subscription.status = past_due`.
- **Plans** — edit name/price/limit/features/trial/refund per plan; toggle active.

## API (`/api/admin/*` — `requireRole` + Zod + audit)
```
GET   /api/admin/subscriptions?status=&plan=                     (support)
GET   /api/admin/refunds?status=pending                          (support)
POST  /api/admin/refunds/:id/approve   { note? }                 (admin)  → stripe refund + sync
POST  /api/admin/refunds/:id/deny      { note }                  (admin)
POST  /api/admin/refunds               { userId, amount, reason } (admin)  // staff-initiated
GET   /api/admin/payments?userId?                                (support)
PATCH /api/admin/plans/:key            { …plan fields }          (admin)
POST  /api/admin/users/:id/subscription { plan?, interval?, trialEndsAt?, status? }  (superadmin)
POST  /api/admin/users/:id/credit       { amount, reason }       (superadmin)
```
- **Refund approve** within policy → call Stripe refund via `src/server/billing.ts`, set
  `RefundRequest.status=refunded` + `stripeRefundId`, re-`syncSubscription`. **Forced**
  refund (outside the `refundDays` window) requires `superadmin` and is flagged in the audit
  metadata as out-of-policy.
- **Manual subscription override / credit** are `superadmin`-only (cross-listed in Phase G):
  set plan/trial/status directly (mock mode) or via Stripe (live), then `syncSubscription`.
- All mutations `logAdminAction()` with before/after + amounts.

## Metrics (`src/server/admin/metrics.ts`, extends Phase A)
MRR, ARPU, active vs trialing vs past-due counts, 30-day churn, trial→paid conversion, plan
mix — from `Subscription` rows; optionally reconcile MRR against Stripe in live mode.

## Edge cases
- **Mock vs live billing:** honor `BILLING_MODE` — in mock mode, "refund"/override update
  the local `Subscription` (and `RefundRequest`) without calling Stripe; in live mode, hit
  Stripe then let the webhook reconcile. Keep both paths idempotent (key on `stripeSubId` /
  `stripeRefundId`), matching doc 10.
- Refund already refunded / outside window → block with a clear message (force = superadmin).
- Editing a plan's `accountLimit` **below** some users' current account count → existing
  accounts kept but flagged "over limit" (don't delete) — same rule as doc 10.
- Plan-row cache invalidation after edit so gates pick up new limits.

## Acceptance criteria
- Customer "Request Refund" creates a `pending` `RefundRequest`; it appears in the admin
  queue.
- Approving an in-policy refund issues a Stripe refund (test mode) and flips status to
  `refunded`; subscription state reconciles.
- Editing a plan updates the customer Plans/Billing pages and the server-side gates.
- Subscriptions list + metrics reflect real subscription state.

## Verification
1. As a customer, request a refund within 7 days → appears in `/admin/refunds` as pending.
2. Approve it (Stripe test mode) → refund created, status `refunded`, `AuditLog` entry.
3. Edit Creator's `accountLimit` to a low number → a customer at that limit is blocked from
   new connects (gate honored).
4. Toggle `BILLING_MODE=mock` → a manual plan override updates `Subscription` without Stripe.

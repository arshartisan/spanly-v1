# 19 — Admin: System Health & Operations

> **Provider note (D-021):** the inbound webhook event log source is now **`paypal`** (was
> `stripe`); events come from `/api/webhooks/paypal`.

**Design refs:** `../15-admin-dashboard.md` (E — System & Operations).
**Depends on:** `15-admin-foundation-and-access.md`, `08-scheduling-and-queue.md` (BullMQ
queues + maintenance), `09-publishing-flow.md`, `10` (Stripe webhooks).
**Build phase:** Phase 9 · **Permissions:** view = `support`; job retry/remove & sweep
triggers = `admin`.

## Scope
Keep publishing healthy: inspect the BullMQ queues, retry/remove failed jobs, trigger the
maintenance sweeps on demand, watch system health, review the Stripe/webhook event log, and
see which posts exhausted their retries. Reuses the existing queue clients, worker tasks,
and `/api/health` — this phase **reads and controls** that infrastructure, it doesn't
replace it.

## Pages
```
src/app/(admin)/admin/system/page.tsx           // health + queue summary — RSC
src/app/(admin)/admin/system/jobs/page.tsx      // failed/active job list — RSC + client
src/app/(admin)/admin/system/events/page.tsx    // webhook/Stripe event log — RSC
src/server/admin/ops.ts                          // queue inspection + controls
```

### Queue monitor (`/admin/system`, `/admin/system/jobs`)
- Per queue (`publish`, `media`, `maintenance`): counts of
  active/waiting/delayed/completed/failed via BullMQ `queue.getJobCounts()` (reuse the queue
  clients in `src/server/queue/index.ts`).
- **Failed-job list:** jobId, target/post, attempts, error, failedReason, timestamps.
  Actions: **Retry** (`job.retry()`) and **Remove** (`job.remove()`).
- **Maintenance controls:** buttons to enqueue `missed-run-sweep`, `drafts-cleanup`,
  `token-refresh-sweep` immediately (reuse the task names/handlers in
  `src/server/maintenance.ts` + `worker/index.ts`); show last-run result.

### System health (`/admin/system`)
- Extend `src/app/api/health` into a richer admin check: DB (`prisma.$queryRaw`), Redis
  ping, object storage reachability, and each provider's status flag. Render green/red tiles
  with latency.

### Event log (`/admin/system/events`)
- Recent inbound **Stripe webhook** events and outbound **user webhook** deliveries:
  event type, status, attempts, last error. Backed by a lightweight `WebhookEvent` log
  (below) written by the existing webhook handlers.

### Failed-publish dashboard
- `PostTarget` where `status=failed` (attempts exhausted), grouped by platform + error
  class; links to the post in `/admin/content`. Helps spot a provider-wide outage.

## Data model (delta — optional but recommended)
```prisma
model WebhookEvent {
  id        String   @id @default(cuid())
  source    String   // "stripe" | "user_webhook"
  type      String
  status    String   // received | processed | failed | delivered
  refId     String?  // stripe event id / post id
  attempts  Int      @default(1)
  error     String?
  createdAt DateTime @default(now())
  @@index([source, createdAt])
}
```
> Have the existing `/api/webhooks/stripe` and `deliverPostWebhook()` write a
> `WebhookEvent` row. If you'd rather not add a table for MVP, read Stripe events live via
> `stripe.events.list` and skip the user-webhook log — note the choice in `DECISIONS.md`.

## API (`/api/admin/system/*` — `requireRole` + audit on control actions)
```
GET  /api/admin/system/health                                  (support)
GET  /api/admin/system/queues                                  (support)
GET  /api/admin/system/jobs?queue=&state=failed                (support)
POST /api/admin/system/jobs/:queue/:jobId/retry                (admin)
POST /api/admin/system/jobs/:queue/:jobId/remove               (admin)
POST /api/admin/system/maintenance/:task                       (admin) // task ∈ sweeps
GET  /api/admin/system/events?source=                          (support)
```
Job retry/remove and sweep triggers call `logAdminAction()` (`job.retry`, `job.remove`,
`maintenance.run`).

## Edge cases
- Queue clients connect to Redis lazily (`src/server/redis.ts`) — handle Redis-down
  gracefully (health shows red; job pages show an error, not a crash).
- Retrying a job whose target already succeeded is a no-op (`publishTarget` is idempotent).
- Triggering a sweep that's already mid-run is safe (repeatable jobs are dedup'd by jobId).
- Reading BullMQ from the Next.js process is fine for inspection; never run the worker loop
  inside the web server (keep the dev-worker single-instance rule).

## Acceptance criteria
- Queue summary shows live counts per queue; failed jobs list with errors.
- Retry re-enqueues a failed job; Remove deletes it; both audited.
- Manual maintenance trigger runs the corresponding sweep and reports a result.
- Health tiles flip red when a dependency (e.g. Redis) is down.

## Verification
1. Force a publish failure (mock provider error) → job appears in failed list → Retry →
   it re-runs; check `AuditLog` for `job.retry`.
2. Stop Redis → `/admin/system` health shows Redis red and the page still renders.
3. Trigger `token-refresh-sweep` from the UI → maintenance handler runs; last-run updates.
4. Confirm a Stripe test webhook produces a `WebhookEvent` (or shows in the live events list).

# 08 — Scheduling Engine & Queue

**Design refs:** `../11-settings.md` (Queue), `../01-create-post.md` (schedule card).
**Depends on:** `00` (BullMQ/Redis + separate worker), `01` (Post/PostTarget/QueueSettings),
`02`/`09` (publish).

## Goal
Reliably publish posts at their scheduled time, exactly once per target, with retries on
transient failures and recovery for missed runs. This is the riskiest subsystem — design for
**idempotency** and **durability**.

## Components
- **Queues (Redis/BullMQ)** in `src/server/queue/`:
  - `publishQueue` — one job per **PostTarget** (`{ targetId }`), delayed to `publishAt`.
  - `mediaQueue` — `media.process` (ffmpeg re-encode/thumbnail).
  - `maintenanceQueue` — repeatable: drafts cleanup (doc 07), missed-run sweep, token-refresh
    sweep.
- **Worker** (`worker/index.ts`) — a **separate always-on Node process** (not serverless).
  Consumes the queues and calls providers.

## Enqueue model (post-level → target-level)
When the composer calls `publish`/`schedule`/`queue` (doc 06):
1. Create the Post + one `PostTarget` per selected account, each with a unique
   `idempotencyKey` (`<postId>:<accountId>`) and resolved `caption`.
2. For each target, add a `publishQueue` job:
   - **now** → no delay.
   - **time** → `delay = publishAt - now`.
   - **queue** → compute `publishAt` = next open slot, then delay as above.
   Use BullMQ `jobId = target.idempotencyKey` so duplicate enqueues collapse.

## Queue-slot computation ("Add to queue")
From `QueueSettings` (timezone + slots: `{ time, days[7] }`) and
`randomizeWithinMinutes`:
```
nextSlot(now, settings):
  walk forward day by day (in settings.timezone)
  for each day where days[weekday] is true:
    for each slot time on that day (sorted):
      candidate = that local datetime → UTC
      if candidate > now AND not already taken by another queued post:
        if randomize>0: candidate += rand(0..randomize) minutes  (vary per index, not Math.random in app — worker may use crypto)
        return candidate
```
- "Taken" = another `status=scheduled, scheduleMode=queue` post already at that slot.
- Editing queue slots in Settings does **not** move already-scheduled posts (design note).

## Worker job: publish a target
```
process publishQueue { targetId }:
  target = load PostTarget (+ post, account)
  if target.status in (success) → return            // idempotent: already done
  set target.status = publishing, attempts++
  set parent Post.status = publishing (if first target)
  tokens = decryptTokens(account.encryptedTokens)
  if token expired → provider.refresh → persist
  result = provider.publish({type,caption,media,idempotencyKey}, tokens)
  if result.ok:
     target.status=success, externalPostId/url, publishedAt=now
  else if result.retryable AND attempts < MAX (e.g. 5):
     throw → BullMQ retries with exponential backoff (e.g. 30s,2m,10m,...)
  else:
     target.status=failed, error=result.error
  recomputePostStatus(post)   // see below
```

### Parent post status rollup
```
recomputePostStatus:
  if all targets success → Post.status = posted, publishedAt = max(target.publishedAt)
  else if any target publishing/pending → publishing
  else if all terminal and some failed → failed (partial failures still 'failed' surface;
        UI shows per-target success/fail, doc 09)
```

## Idempotency & exactly-once
- `PostTarget.idempotencyKey` unique in DB + used as BullMQ `jobId`.
- Worker re-checks `status===success` before publishing (covers retries/restarts).
- Where the platform API supports an idempotency token, pass `idempotencyKey` through.

## Missed-run recovery
- `maintenanceQueue` repeatable job (every 1–2 min): find
  `Post.status in (scheduled) AND publishAt < now - grace` whose targets have no live job
  (e.g. Redis was down) → re-enqueue. The `EXPLAIN`-friendly index `@@index([status, publishAt])`
  (doc 01) backs this query.

## Retry / backoff / rate limits
- BullMQ `attempts: 5`, `backoff: { type:'exponential', delay: 30000 }`.
- Respect provider rate limits: per-platform concurrency limiter in the worker (e.g. a
  BullMQ group or limiter) so we don't burst YouTube/X quotas.
- Non-retryable errors (bad media, revoked token) fail fast; set account `status=expired` on
  auth errors and surface Refresh (doc 05).

## Timezones
- Store `publishAt` in **UTC**; keep `Post.timezone`. Compute slots and display in user tz.
- Use a tz lib (e.g. `date-fns-tz` / `Luxon`). Never use the server's local tz implicitly.

## Acceptance criteria
- A post scheduled for T publishes within a small window of T (worker latency).
- Each target publishes exactly once even if the worker restarts mid-run.
- Transient failures retry with backoff; permanent failures mark target `failed`.
- "Add to queue" lands posts in the correct next open slot honoring days + timezone.
- Killing Redis during a scheduled window and restarting → missed-run sweep recovers it.

## Verification
1. Schedule a mock post 1 minute out → worker publishes it; targets go `success`; post
   `posted`.
2. Set `MOCK_FAIL_PLATFORMS=tiktok` → TikTok target retries then fails; others succeed; post
   surfaces partial failure.
3. Enqueue the same target twice (simulate double submit) → only one publish occurs.
4. Configure 2 weekday slots; queue 3 posts → they fill slot1, slot2, then next day slot1.
5. Stop worker past a scheduled time, restart → missed post still publishes.

# 09 — Publishing Flow (Progress & Results)

**Design refs:** `../03-publishing-flow.md`. **Depends on:** `06` (compose), `08` (worker),
`02` (provider.publish).

## Scope
The user-facing flow after "Post now" (and the result view for any published post): a
progress screen that polls until all targets resolve, then per-platform success/failure
result cards with retry.

## Screens
### A) Publishing progress (`/publishing/[postId]`)
- Shown immediately after "Post now" (or when opening a `publishing` post).
- Spinner + "Publishing your post…", a **"Check status"** affordance, and a "Create another
  post" link.
- Auto-refresh: poll `GET /api/posts/:id` every ~2s (or subscribe via SSE) until
  `Post.status` is terminal (`posted` or `failed`).

### B) Result cards
- One card per **PostTarget**: platform icon + account handle + status:
  - **success:** green "Success" badge + "View post" link (`externalUrl`).
  - **failed:** red "Failed" badge + error message + **Retry** button.
- Show the caption used (per-target `caption`).
- Summary line: "Published to 5 of 6 accounts."

## Publish orchestration (recap from doc 08)
- "Post now" → `POST /api/posts/:id/publish`:
  - validate (provider.validate per target) → create `PostTarget`s → set Post `publishing`
    → enqueue immediate `publishQueue` jobs → redirect to `/publishing/:id`.
- The worker performs the actual `provider.publish` and updates each target (doc 08).

## Retry
```
POST /api/posts/:id/targets/:targetId/retry
  • only allowed when target.status = failed
  • reset status=pending, keep idempotencyKey, re-enqueue publishQueue job
```
- Retrying a single target does not touch successful ones.

## Polling/refresh API
```
GET /api/posts/:id  → { post, targets:[{platform,handle,status,externalUrl,error}] }
```
- Frontend stops polling when all targets are terminal.
- Optional enhancement: Server-Sent Events `/api/posts/:id/events` for push updates.

## Edge cases
- All targets fail → Post `failed`; offer "Retry all".
- Partial success → Post surfaces failed (per design), but successful targets show green +
  links and are **not** re-published on "Retry all" (idempotency).
- Account token expired at publish → that target fails with an auth error + a "Reconnect"
  link to `/connections` (doc 05).
- User closes the progress page → posts still publish (worker is independent); results appear
  in Posts list (doc 07) and on reopening `/publishing/:id`.

## Acceptance criteria
- After "Post now", the progress screen appears and auto-resolves to result cards.
- Each target shows correct success/fail with link or error.
- Retry re-publishes only the failed target and never duplicates a success.
- Navigating away does not interrupt publishing.

## Verification
1. Post now to all 6 mock accounts → progress → 6 green result cards with mock "View post"
   links; Post = `posted`.
2. `MOCK_FAIL_PLATFORMS=x` → X card red with error + Retry; others green; summary "5 of 6".
3. Click Retry on X (flip mock to succeed) → X turns green; others unchanged; no duplicate
   external IDs.
4. Reload `/publishing/:id` after completion → shows final result cards (not the spinner).

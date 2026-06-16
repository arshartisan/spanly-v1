# 18 — Admin: Content & Connections Oversight

**Design refs:** `../15-admin-dashboard.md` (D — Content & Connections).
**Depends on:** `15-admin-foundation-and-access.md`, `01` (Post/PostTarget/SocialAccount),
`08-scheduling-and-queue.md` (queue/cancel), `09-publishing-flow.md`, `05-connections.md`.
**Build phase:** Phase 9 · **Permissions:** view = `support`; cancel/takedown &
force-disconnect = `admin`.

## Scope
Platform-wide oversight of **what is being published and by whom**. Spanly relays content to
external platforms (it does not host published posts), so "moderation" = stopping
*scheduled* sends and disconnecting abusive accounts, not editing already-live posts. Reuses
the queue/cancel and connection helpers rather than new publishing logic.

## Pages
```
src/app/(admin)/admin/content/page.tsx          // cross-user post list — RSC
src/app/(admin)/admin/content/[postId]/page.tsx // post detail + targets — RSC
src/app/(admin)/admin/connections/page.tsx      // all social accounts — RSC
src/components/admin/content/ContentFilters.tsx  // "use client"
src/server/admin/content.ts                      // queries + moderation actions
```

### Content (`/admin/content`)
- Cross-user `Post[]` list; filters: status (`draft|scheduled|publishing|posted|failed`),
  platform (via `PostTarget.account.platform`), date range, user. Columns: user, type,
  caption snippet, status, target platforms, scheduled/published time.
- **Detail** (`/admin/content/[postId]`): caption, media thumbnails, per-`PostTarget`
  status + external URL + error. Actions:
  - **Cancel scheduled** — for `scheduled`/`pending` posts: remove queued BullMQ jobs and
    mark targets canceled (reuse the queue removal used by user-side delete in
    `src/server/posts.ts` / `src/server/queue/index.ts`).
  - **Takedown** — mark the post removed and cancel any pending targets; cannot un-publish
    an already-sent platform post (note this limitation in the UI).

### Connections (`/admin/connections`)
- All `SocialAccount[]` across users; filters: platform, status (`active|expired|error`),
  token health (expiring ≤24h / expired via `tokenExpiresAt`). Columns: user, platform,
  handle, status, connected, token expiry.
- **Force-disconnect** — soft-delete the account (set `disconnectedAt`, `status=error`)
  reusing the existing disconnect path in `src/server/connections.ts`; pending targets for
  that account fail gracefully. **Never log or expose `encryptedTokens`.**

## API (`/api/admin/*` — `requireRole` + Zod + audit)
```
GET  /api/admin/content?status=&platform=&userId=&from=&to=        (support)
GET  /api/admin/content/:postId                                    (support)
POST /api/admin/content/:postId/cancel    { reason }               (admin) → cancel pending targets
POST /api/admin/content/:postId/takedown  { reason }               (admin)
GET  /api/admin/connections?platform=&status=                      (support)
POST /api/admin/connections/:id/disconnect { reason }              (admin)
```
All mutations call `logAdminAction()` (`content.cancel`, `content.takedown`,
`account.force_disconnect`) with the reason in metadata.

## Edge cases
- **Race with the worker:** a post mid-`publishing` may complete before cancel lands —
  cancel only affects `pending` targets; reflect partial outcomes (some sent, some
  canceled) honestly in the UI.
- Force-disconnecting an account with scheduled posts → those targets fail with a clear
  error; surface the affected-post count in the confirm dialog.
- Filtering by platform requires joining through `PostTarget` — index/limit appropriately.
- Media URLs in admin views are the same signed/stored URLs; don't leak them beyond staff.

## Acceptance criteria
- Admin can list and filter posts and accounts across **all** users.
- Cancel removes the queued jobs and marks targets canceled; the post no longer publishes.
- Force-disconnect soft-deletes the account and is reflected on the user's Connections tab.
- Every moderation action is audited with a reason; tokens are never exposed.

## Verification
1. Schedule a post as a test user → find it in `/admin/content` filtered by `scheduled` →
   Cancel → confirm the BullMQ job is gone and targets are canceled.
2. Force-disconnect a connected account → user's Connections shows it disconnected;
   `AuditLog` has `account.force_disconnect` with reason.
3. Filter connections by "expired" → only accounts with `tokenExpiresAt` in the past show.

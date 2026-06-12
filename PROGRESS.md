# Spanly — Progress / TODO

Status tracker across sessions. Update after each phase; stop for human sign-off at each
checkpoint. Legend: ☐ todo · ◐ in progress · ☑ done.

## Phase 0 — Discovery & Breakdown
- ☑ Crawl Post-Bridge + read all `docs/` specs
- ☑ Feature inventory (MVP vs later), user flows, monetization, platform reality check
- ☑ Draft data model + NFRs
- ☑ Decisions locked: pricing (docs model), 6 platforms, defer workspaces/teams, Next.js+Prisma
- ☑ Plan approved by human

## Phase 0.5 — Implementation specs (this deliverable)
- ☑ `docs/implementation/` doc set (README + 00–13)
- ☑ `DECISIONS.md`, `PROGRESS.md`
- ☐ **HUMAN CHECKPOINT:** review implementation docs before any code

## Phase 1 — Foundation (`docs/implementation/00–02`)
- ☑ Scaffold Next.js (App Router, TS) + Tailwind + **shadcn/ui** (utils + button/card base
      components, green/light-gray theme tokens — see `docs/implementation/14`)
- ☑ `docker-compose.yml` (Postgres, Redis, MinIO + bucket setup)
- ☑ Prisma schema + seed script (demo user, 6 mock accounts, plans, queue)
- ☑ Provider abstraction + MockProvider + registry (+ vitest, 6 tests passing)
- ☑ `/api/health`; env wiring (`.env` generated); token crypto util (AES-256-GCM)
- ☑ Scheduler worker boots (`worker/index.ts`, separate process)
- ☑ Verified (no infra): `npm install`, `prisma generate`, `tsc --noEmit`, `next build`,
      `vitest` all green; `ioredis` deduped to a single copy
- ☑ Verify with infra (2026-06-12): `docker compose up -d` (pg/redis/minio all healthy) →
      `prisma migrate dev --name init` (migration `20260612120735_init`) → `npm run db:seed`
      (demo user + 6 mock accounts + trialing Creator plan + 2 queue slots) →
      `GET /api/health` = `{db:ok,redis:ok,providerMode:mock}` → worker ready (listening on
      "publish" queue). Integrity after power-cut: `tsc --noEmit` clean, `vitest` 6/6.
      Note: `db:migrate` script (`prisma migrate dev`) prompts for a name interactively — use
      `prisma migrate dev --name <x>` or `migrate deploy` in non-interactive runs.
- ☐ CHECKPOINT (human)

## Phase 2 — Auth & Shell (`03–04`)
- ☑ Auth (custom DB-session layer per **D-012**, not NextAuth): bcrypt + opaque session
      token in `Session` + httpOnly cookie; `src/server/auth.ts`, edge `middleware.ts`
      (cookie-presence gate), console mailer (**D-013**), Redis rate-limiter.
      Routes: signup/login/logout/forgot/reset/signout-all (+ `/verify` page). Pages:
      `(auth)/{login,signup,forgot,reset,verify}`. SHA-256-hashed single-use tokens.
- ☑ App shell + sidebar (nav map, active state) + account menu (sign-out) +
      workspace switcher (static, D-004) + dashboard (stats vs connect-first empty state).
      `(app)/layout.tsx` does full DB session validation; `/` redirects by auth state.
      Added shadcn `input/label/avatar/dropdown-menu`; deps `@radix-ui/react-{dropdown-menu,avatar,label}`.
- ☑ Fixed latent dev-only bug: `tailwind.config.ts` used CJS `require("tailwindcss-animate")`
      which crashed the dev CSS pipeline (ESM `require` undefined) on the first styled page —
      switched to an ESM import. (Never hit in Phase 1: dev only served `/api/health`.)
- ☑ Verified (2026-06-12, infra up): `tsc` clean, `next build` (16 routes) green, `vitest` 6/6,
      and a 16-check live smoke test on the running app — middleware guard, login/401,
      signup→trialing sub+2 queue slots, stats vs empty-state dashboard, duplicate=409,
      sign-out-all invalidates current session, reset sets new password + invalidates old
      sessions + single-use token, email-verify token confirms. Console mailer logs links.
- ☐ **CHECKPOINT (human):** review auth + shell; confirm D-012/D-013 deviations are OK.

## Phase 3 — Connections (`05`)
- ☑ Connections page (`/connections`): one row per platform (icon + dark Connect button +
      account chips), Show-IDs toggle + platform filter, ?connected/?error banners. Components
      `connections/{ConnectionsView,PlatformRow,AccountChip,ConnectButton,InstagramMethodModal}`
      + `lib/platform-style.ts`. IG Connect opens a lightweight method-choice modal (Instagram
      vs Facebook-Page), forwarded as `?method=`.
- ☑ OAuth flow via MockProvider (full-page redirect, internal mock consent page at
      `/connect/[platform]/mock` with Allow/Cancel): `GET /api/connect/[p]/start` (session +
      limit gate → signed state → provider auth URL), `GET /api/connect/[p]/callback` (verify
      state → handleCallback → encrypt tokens → **upsert** SocialAccount), `POST
      /api/accounts/[id]/refresh`, `DELETE /api/accounts/[id]` (soft-delete per D-010).
      CSRF state = HMAC-SHA256 (keyed by NEXTAUTH_SECRET) + 10-min expiry (`server/oauth-state.ts`).
      Account-limit gate is server-side in `/start`; reconnecting a platform you already have
      never consumes a new seat (`server/connections.ts`).
- ☑ Verified (2026-06-12, infra up): `tsc` clean, `next build` (21 routes) green. Live smoke
      test on a fresh signup user (all green): page loads at 0/15 · start→mock with signed state ·
      unauth start→/login · **all 6 platforms connect** → active chips · tokens stored as
      ciphertext (not JSON) in `encryptedTokens` · IG via Facebook sets igConnectMethod=facebook
      + pageId · reconnect upserts (no dup row) · refresh→active + new expiry · disconnect→
      soft-delete (disconnectedAt + status=error), drops from active list · reconnect re-activates
      same row · **account-limit gate**: at 15/15 a platform with no seat is blocked (?error=limit)
      while reconnect of an existing platform is allowed · unauth refresh/delete→401 · tampered
      state→?error=state. Mock consent page renders Allow/Cancel + IG method label. Throwaway
      test user purged; seed demo user intact (6 accounts).
- ☑ **CHECKPOINT (human):** reviewed connections flow; mock-OAuth + account-limit UX signed off (2026-06-12).

## Phase 4 — Composer + Media (`06`)
- ☑ Type-parameterized composer (`/create/[type]`, one component for text/image/video/story):
      capability-filtered account row, caption field w/ circular counter ring (limit = min
      captionMax across selected), per-platform caption tabs (≥2 accounts), upload dropzone
      (click/drag/paste; story = exactly 1 media), schedule card (Post now · Pick a time +
      quick-set chips · Add to queue · Save to Drafts), type switcher, Remember toggle
      (localStorage). Components in `src/components/composer/` + `CreatePostButton` already
      routes to `/create/text`.
- ☑ Media presign/finalize: `src/server/storage.ts` (S3/MinIO presigned PUT, path-style;
      `@aws-sdk/client-s3` + `s3-request-presigner`) + `POST /api/media/{presign,finalize}`.
      Browser uploads direct-to-S3; finalize persists Media (processed=false; ffmpeg = Phase 5).
- ☑ Draft/post-now/schedule/queue wiring: `src/server/posts.ts` (createDraft, update, delete,
      duplicate, publishNow, schedulePost, addToQueue) + `src/lib/schemas/post.ts` (zod +
      isomorphic `validatePostTargets`/`captionLimitFor`/`canSubmit`/`resolveCaption`) +
      `src/server/queue-slots.ts` (next open slot in user tz via Intl offset, DST-refined).
      Routes: `POST /api/posts`, `PATCH/DELETE /api/posts/[id]`,
      `POST /api/posts/[id]/{publish,schedule,queue,duplicate}`. On dispatch: one PostTarget
      per account w/ resolved caption + idempotencyKey `<postId>:<accountId>`; server
      re-validates per-platform limits. NOTE: BullMQ enqueue + actual dispatch is Phase 5 —
      post-now sets status=publishing but nothing publishes yet (clean phase boundary).
- ☑ Verified (2026-06-12, infra up): `tsc` clean, `next build` (30 routes, incl. all 11 new),
      `vitest` 6/6. 23-check live smoke (all green): presign auth-gate (401/200) · direct PUT
      to MinIO + finalize Media row · draft create (201) · **300-char text→X publish=422**
      (over-limit gate) · **schedule**: status=scheduled/mode=time/publishAt set, **X target =
      main caption, LinkedIn target = per-platform override**, idempotencyKeys unique+formatted ·
      **queue**: mode=queue, slot lands on configured 11:00/16:00 Asia/Colombo, future · story
      0-media=422 / 1-media=200 · story→X (no story cap)=422. Pages: `/create/{text,image,video,
      story}`=200 w/ titles, `/create/bogus`=404, unauth→`/login?next=`. Throwaway sessions/
      posts/media purged. (Mid-test 500s were a stale dev-server worker pool from concurrent
      npm install/remove — clean `.next` + dev restart resolved; not a code issue.)
- ☑ **CHECKPOINT (human):** reviewed composer + media + draft/schedule/queue wiring; Phase-4/5
      boundary (records created, dispatch deferred) signed off (2026-06-12).

## Phase 5 — Scheduling, Lists, Calendar (`07–08`)
- ☑ BullMQ dispatch + worker: enqueue wiring in `posts.ts` dispatch (`enqueueDispatch` →
      `enqueuePublish`, one delayed job per pending target). `worker/index.ts` now runs a real
      publish processor + a maintenance worker. `src/server/publish-runner.ts`
      (`publishTarget` + `recomputePostStatus`): decrypt tokens, lazy-refresh expired tokens
      (auth fail → account=expired + target failed), `provider.publish`, per-target status, and
      parent-post rollup (all success→posted, any active→publishing, else→failed). Retry =
      throw while `retryable && attempts < 5` (BullMQ exp-backoff 30s); terminal `failed` once
      exhausted. **Idempotency:** target re-checks `status===success` first; BullMQ `jobId =
      publish-<targetId>` (NOT idempotencyKey — BullMQ forbids ":" in custom ids; targetId is
      1:1 with the target so dedup is preserved).
- ☑ Maintenance sweeps (`src/server/maintenance.ts`) on repeatable schedules: missed-run sweep
      (every 60s; re-enqueue due `scheduled`/`publishing` posts with pending targets),
      token-refresh sweep (30m), **drafts 90-day cleanup** (daily 03:00).
- ☑ Posts lists `/posts/[filter]` (all/scheduled/posted/drafts): URL-driven filter bar
      (sort/platform/type), post cards (date+time in user tz, type chip, caption snippet,
      stacked target avatars, status badge), empty states. Components in `src/components/posts/`
      + `src/lib/post-display.ts`.
- ☑ Calendar `/calendar` month + week: posts placed by `publishAt`/`publishedAt` bucketed to
      the user's tz day (DST-safe via `Intl`-offset day keys, `src/lib/calendar.ts`); 1 chip per
      post w/ stacked platform icons + status dot; prev/next + Today + month/week toggle +
      platform filter; click empty day → `/create/text?date=`, click chip → edit. Drafts (no
      publishAt) excluded.
- ☑ Composer edit + prefill (completes doc 06 edit): `/create/[type]?postId=` rehydrates the
      post (captions/targets/media), PATCHes on submit, Duplicate/Delete actions, read-only
      banner for posted/publishing; wrong-type URL redirects to the post's type;
      `?date=YYYY-MM-DD` prefills the schedule day. Makes list/calendar cards clickable.
- ☑ Verified (2026-06-12, infra + worker up): `tsc` clean, `next build` (32 routes), `vitest`
      6/6. **20-check engine smoke** (all green): publishTarget success→target success+url + post
      rollup=posted; retryable fail→throws, target back to pending, attempts++, error set;
      terminal fail (attempts exhausted)→target failed + post failed; **missed-run sweep
      re-enqueues → live worker publishes → posted**; 90-day draft deleted while recent draft
      kept; **end-to-end post-now over HTTP → enqueue → worker → posted** w/ externalUrl.
      **18-check UI smoke**: all 4 list filters 200 + correct membership + platform filter,
      `/posts/bogus`=404, calendar month/week 200 w/ chip on correct tz day, composer edit
      (Edit title + rehydrated caption), wrong-type redirect, `?date=` prefill. Throwaway data
      purged. NOTE: live partial-failure UX (MOCK_FAIL result cards + per-target retry) is the
      Phase 6 publishing flow (doc 09); the worker failure branches themselves are verified here.
- ☑ **CHECKPOINT (human):** reviewed scheduling engine + lists + calendar; separate-worker +
      idempotency/retry model signed off (2026-06-12).

## Phase 6 — Publishing (`09`)
- ☑ Publishing flow (mock providers): `/publishing/[postId]` progress screen — server-loads the
      initial state, client `PublishingView` polls `GET /api/posts/[id]` every 2s until terminal
      (`posted`/`failed`), then renders per-target result cards (`ResultCard`): platform icon +
      handle + status badge, caption used, success→"View post" (externalUrl), failed→error +
      **Retry** (auth/expired errors show **Reconnect** → `/connections` instead). Summary line
      "Published to N of M accounts"; all-failed posts get **Retry all**. Components in
      `src/components/publishing/` (+ `types.ts`).
- ☑ Polling + retry API: `GET /api/posts/[id]` (post + targets w/ platform/handle/status/
      externalUrl/error/caption, via `getPublishingState`), `POST /api/posts/[id]/targets/
      [targetId]/retry` (failed→pending, keep idempotencyKey, attempts=0, re-enqueue — successes
      untouched so no double-post), `POST /api/posts/[id]/retry-all`. Service fns `getPublishingState`/
      `retryTarget`/`retryAllFailed` in `posts.ts`.
- ☑ Wiring: composer "Post now" now redirects to `/publishing/[id]` (was a generic success panel);
      `PostCard` + calendar chips route already-dispatched posts (publishing/posted/failed) to the
      result screen, draft/scheduled still open the composer.
- ☑ Verified (2026-06-12, infra + clean worker up): `tsc` clean, `next build` (35 routes, incl.
      `/publishing/[postId]` + 2 retry routes), `vitest` 6/6. **21-check Phase-6 smoke** (all green):
      engine all-success rollup→posted w/ externalUrls; **partial failure (MOCK_FAIL=x)**→post
      failed, X target failed+error+no externalPostId, non-X success; `GET /api/posts/[id]` auth-gate
      (401/200) + target shape + reports failed; retry validation (success target→409, unauth→401,
      retry-all on posted→409); **retry failed X via live worker**→post posted, X success+externalUrl,
      non-X untouched, **single externalPostId (no duplicate)**; post-now happy path→posted w/
      View-post URLs on all targets. Throwaway posts purged.
- ☐ (Then) real providers one platform at a time behind `PROVIDER_LIVE_<P>` (needs approvals)
- ☑ **CHECKPOINT (human):** reviewed publishing flow — result cards, retry semantics (no
      double-post), Reconnect path. Signed off; chose to proceed to Phase 7 (Billing) and defer
      real providers until platform app approvals land (2026-06-12).

## Phase 7 — Billing + Settings (`10–11`)
- ☑ Billing behind `BILLING_MODE=mock|live` (D-014, mirrors MockProvider). `src/server/stripe.ts`
      (lazy SDK client, `APP_URL`, price-id↔plan/interval map both directions, mock placeholders),
      `src/server/plans.ts` (+`requirePlan`/`planAtLeast`/`isOverAccountLimit`/`GateResult`),
      `src/server/billing.ts` (createCheckout, createPortal, toggleApiAddon, requestRefund,
      `syncSubscription` idempotent upsert, `fromStripeSubscription` normalizer, `mockActivate`/
      `mockCancel`). Stripe = source of truth in live mode; mock writes the same Subscription upsert.
- ☑ Billing API: `POST /api/billing/{checkout,portal,addons/api,refund}` (return `{url}`/result),
      `POST /api/webhooks/stripe` (raw-body signature verify → checkout.session.completed /
      subscription.created|updated|deleted / invoice.payment_failed → upsert by stripeSubId;
      no-ops in mock). Mock stand-ins: pages `/billing/mock/{checkout,portal}` + GET
      `/api/billing/mock/{complete,cancel}` (mock-only, 404 in live) — same UX as mock OAuth consent.
- ☑ Settings (doc 11): tab shell `/settings/[tab]` (general|queue|billing|plans, `/settings`→general)
      + `SettingsTabs`. **General** panel (`GeneralPanel`): Profile (display name save; avatar shown,
      upload deferred), Email (change-email re-verify), Password (change + forgot), Security (sign-out-all),
      Email/Platform pref toggles (auto-save), Weekly goal, MCP placeholder, Connected apps. **Queue**
      panel (`QueuePanel`): times×days grid, add/remove time, randomize toggle, tz select. **Billing**
      panel (live sub state, trial badge, annual upsell, API add-on, portal, refund, mock-mode notice).
      **Plans** panel (monthly/yearly toggle, 3 cards, current marked, checkout CTA, over-limit notice).
- ☑ Settings API: `GET/PATCH /api/settings` (profile cols + `User.settings` JSON deep-merge,
      `src/server/settings.ts`, `readSettings` forward-compatible), `GET/PUT /api/queue` (atomic
      replace of `QueueSettings`/`QueueSlot`), `POST /api/auth/{change-password,change-email}`
      (+ zod schemas). `lib/schemas/settings.ts`, `ui/switch.tsx` (no-Radix toggle).
- ☑ Verified (2026-06-12, infra + dev server up, mock billing): `tsc` clean, `next build` (46 routes,
      incl. all billing/settings/queue/webhook routes + mock pages), `vitest` 6/6. **36-check Phase-7
      smoke** (all green): auth gates (settings/queue/checkout 401); settings PATCH persists
      (use24h + weeklyGoal, untouched prefs preserved, goal 99999→422); queue PUT replace (tz +
      randomize + 2 sorted slots persist, bad time→422); **mock checkout→complete→Subscription
      trialing growth/year, trialEndsAt ≈ +7d, stripeSubId set**; API add-on enable/disable reflects
      in DB; portal url; **refund within window→ok**; **mock cancel→status canceled**; password
      change wrong-current→403 / short-new→422; settings tabs 200, /settings/bogus→404,
      /settings→general redirect, unauth→/login. Demo subscription/settings/queue restored after.
- ☐ (Then) live Stripe: set `BILLING_MODE=live` + `STRIPE_*` env (account + Price IDs = human-action
      item); verify in Stripe test mode (checkout→webhook trialing, portal cancel→canceled).
- ☑ **CHECKPOINT (human):** reviewed billing (mock checkout→trial, portal, add-on, refund, plan
      gating) + settings (general/queue persistence). Signed off; chose to proceed to Phase 8
      (API Keys + Webhooks) and defer live Stripe until account + Price IDs are provided (2026-06-12).

## Phase 8 — API Keys + Webhooks (design doc `12`)
- ☑ Schema: `ApiKey` (sha256 `hashedKey` + non-secret `prefix`/`last4`, `lastUsedAt`/`revokedAt`),
      `WebhookEndpoint` (per-user `url` + HMAC `secret`), `Post.webhookSentAt` (idempotent delivery).
      Migration `20260612153714_api_keys_webhooks`. (D-017.)
- ☑ Services: `src/server/api-keys.ts` (server-only) — create (plaintext once), list (masked),
      revoke, `authenticateApiKey`, `requireApiAddon` gate, `authorizeApiRequest` (Bearer→key→gate).
      `src/server/webhooks.ts` (**worker-safe**, no server-only) — get/upsert/delete config,
      `signPayload`/`verifySignature` (HMAC-SHA256), `deliverPostWebhook` (claim-then-send,
      time-boxed, swallows errors).
- ☑ Wiring: `recomputePostStatus` (publish-runner) calls `deliverPostWebhook` on transition to a
      terminal state (posted/failed) — fires once via the `webhookSentAt` claim guard; never blocks
      publishing.
- ☑ API: management (session-auth + add-on gate) `GET/POST /api/api-keys`, `DELETE /api/api-keys/[id]`,
      `GET/PUT/DELETE /api/webhook`. Public (Bearer key) `GET /api/v1/me`, `GET /api/v1/accounts`,
      `POST /api/v1/posts` (text; reuses `createDraft`+`publishNow`/`schedulePost`, cleans up orphan
      draft on dispatch failure).
- ☑ UI: `/api-keys` (`ApiKeysView`) — yellow gating banner + Manage Billing when add-on inactive;
      create (copy-once secret reveal), key list (name/masked/created/last-used/revoke), webhook card
      (URL + Save + signing-secret reveal), API docs card. Nav entry under Configuration. `ui/switch`
      reused.
- ☑ Verified (2026-06-12, infra up; smoked against a fresh `next start :3100` to avoid the dev
      server's stale Prisma client): `tsc` clean, `next build` (41 routes, incl. all api-keys/v1/webhook
      routes), `vitest` 6/6. **23-check Phase-8 smoke** (all green): add-on gate (inactive→402, page
      renders banner); management CRUD (create→201+`spb_live_` plaintext, masked in list, list, no-name
      →422, webhook PUT→`whsec_` secret); public v1 (no-auth/bad-key→401, valid→me/accounts, **POST
      /v1/posts→201 publishing**, add-on-off→402, revoke→401); **webhook delivery** (sign/verify +
      tamper-reject; in-process 2-target publish→posted→**exactly one signed delivery**, valid HMAC,
      payload event/status/targets correct, `webhookSentAt` stamped, **re-delivery no-op**). Test
      keys/webhook/posts purged, add-on restored.
- ☐ (Later) media-in-API for `POST /v1/posts`; webhook retries/delivery log; rotate-secret action.
- ☑ **CHECKPOINT (human):** reviewed API keys + webhooks — copy-once secret, add-on gating, signed
      post-completion delivery + idempotency. Signed off; chose to proceed to Phase 9 (2026-06-12).

## Phase 9 — Bulk Import (D-018)
- ☑ CSV pipeline: `src/lib/csv.ts` (dependency-free RFC-4180 parser + header→record),
      `src/lib/schemas/bulk.ts` (modes, column set, platform-token resolution (key/label/`twitter`),
      type parse, date/time regexes, row/preview/commit types, `SAMPLE_CSV`). Exported
      `zonedTimeToUtc` from `queue-slots.ts` for CSV local-time → UTC.
- ☑ Service `src/server/bulk.ts` (server-only): `validateImport` (no writes; per-row resolve +
      `validatePostTargets` + schedule/future checks + warnings) and `commitImport` (re-validates,
      then `createDraft`→`schedulePost`/`addToQueue` per valid row; ingests `media_url` as an external
      `Media` row; rolls back orphan draft+media on dispatch failure; per-row outcomes). `listBulkAccounts`
      for the default-account picker. **No new Prisma model / no migration.**
- ☑ API (session-auth): `POST /api/bulk/validate` (preview), `POST /api/bulk/commit` (create+dispatch).
- ☑ UI: `/bulk` (`BulkImportView`) — default-account chips, mode cards (draft/schedule/queue),
      CSV upload+paste+sample/download, Validate → preview table (per-row errors/warnings + summary),
      Import → result panel (created/failed + links to Posts/Calendar). `ui/textarea.tsx` added.
      Nav entry "Bulk Import" under Create.
- ☑ Verified (2026-06-12, infra up; smoked against a fresh `next start :3100`): `tsc` clean,
      `next build` (44 routes, incl. `/bulk` + 2 bulk API routes), `vitest` 6/6. **26-check Phase-9
      smoke** (all green): auth gate (validate no-session→401); validate draft (5 rows; x/linkedin text
      valid, unknown platform/missing-media/unknown-type flagged, image+media valid); schedule mode
      (no-date/past/bad-date flagged, future row valid + `publishAtIso` set); platform-by-name resolves
      to accounts; empty-platforms uses default accounts (and flagged when none selected); commit draft
      (created 2 of 2 valid, invalid skipped); commit schedule (only future row → status scheduled);
      commit queue (rows → status queued); created posts collected + **all cleaned up**. Orphan ingested
      `Media` row purged; demo data intact.
- ☐ (Later) bulk-import history/audit table + double-submit idempotency; media-by-upload (not URL);
      column remapping UI.
- ☐ **CHECKPOINT (human):** review bulk import — CSV validate/preview, draft/schedule/queue commit,
      reuse of composer rules. Then pick the next Phase 9+ feature.

## Phase 11 — MCP server (D-019)
- ☑ `src/server/mcp.ts` (server-only): hand-rolled JSON-RPC 2.0 MCP — `initialize` / `ping` /
      `tools/list` / `tools/call` + notification handling. Tools: `list_accounts`, `create_post`,
      `get_post_status`. Protocol version `2025-06-18`, advertises `{ tools: {} }`.
- ☑ `src/app/api/mcp/route.ts`: Streamable-HTTP transport, **stateless**. Auth via
      `authorizeApiRequest` (same Bearer key + API-add-on gate as v1). Single + batch messages;
      notifications → `202`; `GET` → `405` (no SSE). Parse error → JSON-RPC `-32700`.
- ☑ DRY: extracted `createApiTextPost` into `posts.ts`; both `POST /api/v1/posts` and the MCP
      `create_post` tool now call it (no drift between REST and MCP).
- ☑ Wiring: Settings → General "Connect to Claude (MCP)" card now shows the real endpoint
      (`appUrl('/api/mcp')`) + copy + a Setup Guide link to `/help/mcp`, and notes the add-on/key
      requirement.
- ☑ Verified (2026-06-12, infra up; fresh `next start :3100`): `tsc` clean, `next build` (59 routes),
      `vitest` 6/6. Smoke (part of the 29-check run): MCP no-key/bad-key→401; `initialize`→serverInfo
      + tools capability; `notifications/initialized`→202; `tools/list`→3 tools; `list_accounts`→
      accounts; `create_post`→post id (not isError); `get_post_status`→post + targets; unknown
      tool/bad args→`isError` content; unknown method→`-32601`; `GET`→405; **revoked key→401**.

## Phase 13 — Help center (D-020)
- ☑ `src/lib/help-content.ts`: **7 categories + 36 typed articles** (block arrays), topic coverage
      modeled on a mature scheduler help center (support.post-bridge.com) but **written originally**
      for Spanly — only the 6 platforms + our real limits/flows; omits features we don't have
      (Bluesky/Threads, magic-link login, affiliate, TikTok music, team/VA access — D-004).
      Categories: Getting started · Connections · Creating & scheduling · Media & limits ·
      Account & billing · Troubleshooting · Developers. `getHelpArticle`/`articlesByCategory` helpers.
- ☑ `src/components/help/ArticleBody.tsx` (block renderer: h/p/ul/ol/code) +
      `src/components/help/HelpIndex.tsx` (client search over title/excerpt, grouped by category).
- ☑ Pages: `(app)/help` (searchable index), `(app)/help/[slug]` (**SSG** via `generateStaticParams`,
      article + related + back link, unknown slug → 404). Nav entry "Help Center" under Configuration.
- ☑ Verified: `tsc` clean, `next build` (82 static pages — **36 help articles prerendered**),
      runtime smoke: `/help`→200 (7 categories incl. Connections/Developers), new slugs
      (connect-instagram, connect-tiktok-youtube, duplicate-content, limits-by-platform, refund,
      login-issues, mcp)→200, `/help/<unknown>`→404. Original 13 slugs preserved (no broken links;
      Settings MCP card's `/help/mcp` link intact).
- ☑ Combined Phase 11+13 smoke: **29 checks all green**; test key/post purged, add-on restored to off.

## Phase 9+ — Later
- ☐ Analytics (needs live provider insights APIs) · Content Studio (needs media render pipeline)
- ☐ Live providers behind `PROVIDER_LIVE_<P>` + live Stripe (`BILLING_MODE=live`) — both need
      external accounts/approvals (human-action items).
- ☐ **CHECKPOINT (human):** review MCP server (stateless JSON-RPC, key-gated tools) + help center
      (searchable, SSG articles). Then pick Analytics / Content Studio, or wire a live integration.

## Human-action items (need the human)
- Register developer apps per platform (Meta, TikTok, Google/YouTube, X, LinkedIn) — long
  lead times; start early.
- Provide Stripe account + Price IDs.
- Provide S3/R2 bucket + Redis + Postgres for staging.
- OAuth approval/verification steps and any credential entry.

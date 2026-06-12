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
- ☐ **CHECKPOINT (human):** review composer + media + draft/schedule/queue wiring; confirm the
      Phase-4/5 boundary (records created, dispatch deferred) is OK before building the worker.

## Phase 5 — Scheduling, Lists, Calendar (`07–08`)
- ☐ BullMQ queues + worker; due-post dispatch; idempotency; retry; missed-run sweep
- ☐ Queue slot computation; posts lists + filters + badges; calendar month/week
- ☐ Drafts 90-day cleanup job
- ☐ CHECKPOINT

## Phase 6 — Publishing (`09`)
- ☐ Publish orchestration; progress screen; per-target result cards; retry
- ☐ (Then) real providers one platform at a time behind `PROVIDER_LIVE_<P>` (needs approvals)
- ☐ CHECKPOINT

## Phase 7 — Billing (`10–11`)
- ☐ Stripe checkout/portal/webhooks; plans/billing pages; trial; refund; feature gating
- ☐ Settings general + queue tabs
- ☐ CHECKPOINT

## Phase 8+ — Later
- ☐ Content Studio · Bulk tools · Analytics · API keys + webhooks · MCP · Help center

## Human-action items (need the human)
- Register developer apps per platform (Meta, TikTok, Google/YouTube, X, LinkedIn) — long
  lead times; start early.
- Provide Stripe account + Price IDs.
- Provide S3/R2 bucket + Redis + Postgres for staging.
- OAuth approval/verification steps and any credential entry.

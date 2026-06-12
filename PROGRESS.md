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
- ☐ Auth.js credentials + sessions; signup/login/reset/verify; sign-out-all
- ☐ App shell + sidebar + account menu + route map; dashboard empty state
- ☐ CHECKPOINT

## Phase 3 — Connections (`05`)
- ☐ Connections page (6 platforms) + IG method modal
- ☐ OAuth start/callback/refresh/disconnect via MockProvider; account-limit gate
- ☐ CHECKPOINT

## Phase 4 — Composer + Media (`06`)
- ☐ Type-parameterized composer; account selector by capability; per-platform captions
- ☐ Media presign/finalize; validation via provider.validate
- ☐ Draft/post-now/schedule/queue wiring
- ☐ CHECKPOINT

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

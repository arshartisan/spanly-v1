# 00 — Architecture & Stack

## Goal
Define the runtime architecture, technology choices, repository layout, and environment so
every later doc plugs into a known shape.

## Stack (locked)
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One framework for UI + API; RSC; same as reference site. |
| DB | **PostgreSQL 16** | Relational data model; JSON columns where needed. |
| ORM | **Prisma** | Type-safe, easy migrations; see `01`. |
| Auth | **Auth.js (NextAuth v5)** Credentials provider | Email/password + sessions; see `03`. |
| Jobs/Queue | **BullMQ + Redis** | Durable delayed jobs for scheduled publishing + retries. |
| Object storage | **S3-compatible** (AWS S3 / Cloudflare R2 / MinIO in dev) | Media + thumbnails. |
| Payments | **Stripe** (Checkout + Billing Portal + webhooks) | Plans, trial, refund; see `10`. |
| Email | **Resend** (or SMTP) | Verification, password reset, failure alerts. |
| Validation | **Zod** | Shared client/server schemas. |
| UI | **shadcn/ui (Radix primitives) + Tailwind CSS** | **Primary component library** — clean, accessible, consistent layout. All screens compose shadcn components; see `14-ui-components.md`. |
| State (client) | **TanStack Query** + React state | Server-cache + optimistic updates. |
| Video processing | **ffmpeg** worker (optional, "process on our servers" toggle) | Re-encode/normalize uploads. |
| Hosting | **Vercel** (app) + **managed Postgres/Redis** (Supabase/Neon + Upstash) + **R2/S3** | Standard Next.js deploy. The scheduler worker runs as a **separate long-running process** (Railway/Fly/Render), not on serverless. |

> **Critical hosting note:** Vercel serverless functions are short-lived, so the **BullMQ
> worker that publishes scheduled posts must run as its own always-on process** (a small
> Node service). The Next.js app *enqueues* jobs; the worker *executes* them. See `08`.

## High-level architecture
```
                      ┌────────────────────────────────────────┐
        Browser  ───▶ │  Next.js App (Vercel)                   │
                      │  • RSC pages (/app/*)                    │
                      │  • Route handlers (/api/*)               │
                      │  • Auth.js session middleware           │
                      └───────┬───────────────┬─────────────────┘
                              │               │ enqueue(jobs)
                   Prisma     │               ▼
                              ▼        ┌───────────────┐
                       ┌───────────┐   │ Redis (BullMQ)│
                       │ Postgres  │   └──────┬────────┘
                       └───────────┘          │ consume
                              ▲               ▼
                              │       ┌─────────────────────────┐
                       writes │       │ Scheduler Worker (Node)  │
                              └───────│  • due-post dispatch     │
                                      │  • provider.publish()    │
                                      │  • retry/backoff         │
                                      └───────┬─────────────────┘
                                              │ HTTPS
                                              ▼
                                  Platform Providers (Mock → real)
                                  FB · IG · LinkedIn · TikTok · YT · X

   Media:  Browser ──(presigned PUT)──▶ S3/R2 ; app stores Media rows.
   Billing: Stripe Checkout/Portal ; webhooks → /api/webhooks/stripe.
```

## Repository structure (monorepo-lite, single Next.js app + worker)
```
spanly/
├─ package.json                # Next app + worker scripts
├─ next.config.ts
├─ tsconfig.json
├─ .env.example
├─ prisma/
│  ├─ schema.prisma            # doc 01
│  ├─ migrations/
│  └─ seed.ts                  # demo user + mock accounts + plans
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/          # public landing (minimal)
│  │  ├─ (auth)/               # login, signup, reset  (doc 03)
│  │  ├─ (app)/                # authenticated shell    (doc 04)
│  │  │  ├─ layout.tsx         # sidebar shell
│  │  │  ├─ dashboard/
│  │  │  ├─ create/[type]/     # composer              (doc 06)
│  │  │  ├─ posts/[filter]/    # lists                 (doc 07)
│  │  │  ├─ calendar/          # calendar              (doc 07)
│  │  │  ├─ connections/       # connections           (doc 05)
│  │  │  ├─ publishing/[id]/   # publish progress      (doc 09)
│  │  │  └─ settings/[tab]/    # settings/queue/billing/plans (doc 11)
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/
│  │     ├─ posts/             # CRUD + publish/schedule/queue (doc 12)
│  │     ├─ accounts/          # connections API
│  │     ├─ connect/[platform]/start  &  /callback     (doc 05/14)
│  │     ├─ media/             # presign + finalize
│  │     ├─ queue/             # queue slots
│  │     ├─ billing/           # checkout/portal/refund
│  │     └─ webhooks/stripe/
│  ├─ server/
│  │  ├─ db.ts                 # Prisma client singleton
│  │  ├─ auth.ts               # Auth.js config
│  │  ├─ crypto.ts             # token encryption (AES-256-GCM)
│  │  ├─ plans.ts              # plan catalog + limit helpers
│  │  ├─ queue/                # BullMQ queues + connection
│  │  └─ services/             # post, account, media, billing services
│  ├─ providers/               # doc 02
│  │  ├─ types.ts
│  │  ├─ registry.ts
│  │  ├─ mock/
│  │  └─ {facebook,instagram,linkedin,tiktok,youtube,x}/
│  ├─ lib/                     # zod schemas, platform limits, utils
│  └─ components/              # ui/ (shadcn) + feature components
├─ worker/
│  └─ index.ts                 # BullMQ worker entry (separate process)
└─ docs/                       # design + implementation specs (this repo)
```

## Environment / secrets (`.env.example`)
```
# Core
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000

# Encryption for stored OAuth tokens (32-byte hex)
TOKEN_ENC_KEY=...

# Redis / queue
REDIS_URL=redis://localhost:6379

# Object storage (S3/R2)
S3_ENDPOINT=...
S3_REGION=auto
S3_BUCKET=spanly-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_CREATOR_MONTH=price_...
STRIPE_PRICE_CREATOR_YEAR=price_...
STRIPE_PRICE_GROWTH_MONTH=price_...
STRIPE_PRICE_GROWTH_YEAR=price_...
STRIPE_PRICE_PRO_MONTH=price_...
STRIPE_PRICE_PRO_YEAR=price_...
STRIPE_PRICE_API_ADDON=price_...

# Email
RESEND_API_KEY=...
EMAIL_FROM="Spanly <no-reply@spanly.app>"

# Providers — start with mock; fill per platform as approvals land
PROVIDER_MODE=mock            # mock | live
FACEBOOK_CLIENT_ID=...        FACEBOOK_CLIENT_SECRET=...
INSTAGRAM_CLIENT_ID=...       INSTAGRAM_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...        LINKEDIN_CLIENT_SECRET=...
TIKTOK_CLIENT_KEY=...         TIKTOK_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...          GOOGLE_CLIENT_SECRET=...   # YouTube
X_CLIENT_ID=...               X_CLIENT_SECRET=...
```

## Acceptance criteria
- `npm run dev` boots the Next.js app; `npm run worker` boots the BullMQ worker.
- Prisma migrates against a local Postgres; seed creates a demo user + mock accounts.
- `PROVIDER_MODE=mock` makes the whole connect→publish loop work with zero real credentials.
- A health route `/api/health` returns DB + Redis connectivity.

## Verification
1. `docker compose up` (Postgres + Redis + MinIO) — provide a `docker-compose.yml`.
2. `npx prisma migrate dev && npx prisma db seed`.
3. `npm run dev` → open `/login`, sign in as the seeded demo user.
4. `curl localhost:3000/api/health` → `{ db: "ok", redis: "ok" }`.

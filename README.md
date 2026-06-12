# Spanly

Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X
from one place. Built with Next.js (App Router) + PostgreSQL/Prisma + BullMQ.

> Product/architecture decisions: [`DECISIONS.md`](./DECISIONS.md) · progress:
> [`PROGRESS.md`](./PROGRESS.md) · build specs: [`docs/implementation/`](./docs/implementation/).

## Quick start (local dev)

Prerequisites: Node 20+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres + Redis + MinIO
docker compose up -d

# 3. Set up env (a dev .env is already generated; or copy the example)
#    cp .env.example .env   # then fill values

# 4. Create the database schema + seed demo data
npm run db:migrate          # creates tables
npm run db:seed             # demo user, 6 mock accounts, plans, queue

# 5. Run the app and the scheduler worker (two terminals)
npm run dev                 # http://localhost:3000
npm run worker              # background publish worker
```

Health check: `GET http://localhost:3000/api/health` → `{ db: "ok", redis: "ok" }`.

Demo login (after seeding): `demo@spanly.app` / `password` (auth lands in Phase 2).

## Scripts
| Script | What |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run worker` | BullMQ scheduler worker (separate process) |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset DB + re-seed |
| `npm run db:studio` | Prisma Studio |
| `npm run test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |

## Status
**Phase 1 — Foundation.** App shell + theme, Prisma schema + seed, provider abstraction
(MockProvider), health check, worker boot. Everything runs with `PROVIDER_MODE=mock` (no real
platform credentials). See `PROGRESS.md` for the roadmap.

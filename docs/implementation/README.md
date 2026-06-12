# Spanly — Implementation Specs

This folder is the **code-level build blueprint** for Spanly, an original social-media
scheduling app (a clone of the Post-Bridge *concept*, not its code or branding). The
screen-design specs live one level up in `../` (`00`–`14`) and `../../Ref Images/`. These
files translate that design into concrete, implementable engineering specs.

> **Source of truth:** `../` design docs define *what each screen is*. These
> `implementation/` docs define *how to build it* with the chosen stack. Where a design doc
> and reality conflict, the conflict is flagged in `DECISIONS.md` at the repo root.

## Locked decisions (see `../../DECISIONS.md`)
- **Stack:** Next.js (App Router, TypeScript) fullstack · PostgreSQL · Prisma · job queue
  (BullMQ + Redis) · S3-compatible object storage · Stripe · NextAuth (Auth.js).
- **Platforms:** exactly **6** — Facebook, Instagram, LinkedIn, TikTok, YouTube, X.
- **Pricing:** Creator $29 / Growth $49 / Pro $99; billing unit = connected accounts
  (limits 15 / 50 / unlimited); 7-day trial; 7-day refund.
- **Workspaces & Teams:** deferred. MVP = one implicit workspace per user.
- **Providers:** build behind an abstraction; **MockProvider first**, real APIs behind flags.

## How to use these docs with Claude Code
1. Build in the order under **Build order** below — each doc lists its dependencies.
2. For each doc: implement the listed files, satisfy the **Acceptance criteria**, then run
   the **Verification** steps. Update `../../PROGRESS.md` after each.
3. Treat the **Prisma schema** (`01`) and **API surface** (`12`) as contracts — UI and
   backend both conform to them.
4. Keep all platform-touching code behind the **provider abstraction** (`02`). No platform
   SDK calls outside a provider implementation.

## Doc index
| # | File | Build phase |
|---|---|---|
| — | `00-architecture-and-stack.md` | Foundation |
| — | `01-data-model-prisma.md` | Foundation |
| — | `02-provider-abstraction.md` | Foundation |
| — | `03-auth.md` | Phase 2 |
| — | `04-app-shell-and-nav.md` | Phase 2 |
| — | `05-connections.md` | Phase 3 |
| — | `06-composer.md` | Phase 4 |
| — | `07-posts-and-calendar.md` | Phase 5 |
| — | `08-scheduling-and-queue.md` | Phase 5 |
| — | `09-publishing-flow.md` | Phase 6 |
| — | `10-billing-and-plans.md` | Phase 7 |
| — | `11-settings.md` | Phase 7 |
| — | `12-api-surface.md` | Reference (all phases) |
| — | `13-testing-and-qa.md` | Reference (all phases) |
| — | `14-ui-components.md` | Reference (all UI phases) |

## Build order (milestones)
1. **Foundation** — scaffold Next.js app, Prisma schema + migrations, provider abstraction
   with MockProvider, env wiring. (`00`, `01`, `02`)
2. **Auth & shell** — sign up/login/reset/sessions, app layout + sidebar. (`03`, `04`)
3. **Connections** — connect/disconnect/refresh 6 platforms via MockProvider. (`05`)
4. **Composer + media** — type-parameterized composer, per-platform captions, uploads. (`06`)
5. **Scheduling + lists + calendar** — queue, scheduler engine, posts views, calendar.
   (`07`, `08`)
6. **Publishing** — orchestration + result cards; mock → real one platform at a time. (`09`)
7. **Billing** — Stripe checkout/portal, plans, trial, feature gating. (`10`, `11`)
8. **Later** — content studio, bulk tools, analytics, API keys, MCP, help center.

## Conventions
- **TypeScript strict.** No `any` in shared types.
- **UI = shadcn/ui (Radix + Tailwind).** All UI is built from shadcn components for a clean,
  consistent, accessible layout — never hand-roll a primitive that shadcn provides. Full
  guidance + per-screen component map in **`14-ui-components.md`**.
- **Server-first:** React Server Components by default; `"use client"` only for interactivity.
- **Validation:** every API boundary validates input with **Zod**; share schemas between
  client and server.
- **Auth gate:** all `/app/*` routes and `/api/*` handlers (except auth + webhooks) require a
  session.
- **Money/limits:** plan limits enforced **server-side**, never trusted from the client.
- **Time:** store UTC; schedule in user-local tz; render in user-local tz.
- **Secrets:** OAuth tokens encrypted at rest (`02`/`05`). Never log tokens.

# Spanly — Decisions Log

Running log of product + architecture decisions with reasoning. Newest at top. Each entry:
what we decided, why, and any alternative rejected.

---

## 2026-06-12 — Phase 0 & implementation-doc decisions

### D-001 Product: clone the Post-Bridge *concept*, build original
- **Decision:** Build "Spanly", an original social scheduler modeled on Post-Bridge's
  functionality. No copying of their code, branding, copy, or assets.
- **Why:** Project brief. Avoids IP issues; we own the implementation.

### D-002 Platforms: exactly 6
- **Decision:** Facebook, Instagram, LinkedIn, TikTok, YouTube, X. Exclude Bluesky, Threads,
  Pinterest, Google Business everywhere in the UI.
- **Why:** Project brief restricts scope to these 6. Cleaner build, no dead UI.
- **Rejected:** "6 active + scaffold the other 4 as coming-soon" — user chose 6-only.

### D-003 Pricing: use the design-docs model (not the live site)
- **Decision:** Creator $29 / Growth $49 / Pro $99. Billing unit = connected accounts
  (limits 15 / 50 / unlimited). 7-day trial, 7-day refund. $5/mo API add-on.
- **Why:** `docs/` is the stated source of truth and the Billing/Plans screens are built to
  it. The live site shows different numbers ($9/$18/$49) — flagged and overridden.
- **Rejected:** live-site pricing; custom pricing.

### D-004 Workspaces & Teams: deferred
- **Decision:** MVP = single implicit workspace per user; no team invites/roles. Keep a
  `workspaceId`-friendly model for forward-compat (single default workspace).
- **Why:** Removes significant auth/permission complexity from the core loop; not needed to
  validate the product.

### D-005 Stack: Next.js fullstack + PostgreSQL + Prisma
- **Decision:** Next.js (App Router, TS) serving UI + API route handlers; PostgreSQL via
  Prisma; Auth.js (Credentials + DB sessions); BullMQ+Redis for scheduling; S3-compatible
  media storage; Stripe; Resend email; Tailwind + shadcn/ui.
- **Why:** User confirmed Next.js (same framework as the reference site) and Postgres+Prisma.
  Prisma chosen over TypeORM for DX/type-safety.
- **Rejected:** NestJS backend + separate frontend (user clarified they meant Next.js).

### D-006 Scheduler runs as a separate always-on worker
- **Decision:** The Next.js app *enqueues* publish jobs; a standalone Node BullMQ **worker**
  process executes them (hosted on a long-running platform, not Vercel serverless).
- **Why:** Serverless functions are short-lived and can't reliably run delayed/long jobs.

### D-007 Publish exactly-once via per-target idempotency
- **Decision:** One `PostTarget` per (post, account) with a unique `idempotencyKey` used as
  the BullMQ jobId; worker re-checks `success` before publishing; missed-run sweep recovers.
- **Why:** Scheduling reliability NFR — never double-post, never silently drop.

### D-008 Providers behind an abstraction, MockProvider first
- **Decision:** All platform OAuth/publish behind `PlatformProvider`; `PROVIDER_MODE=mock`
  drives the full app with zero real credentials; real providers flip on per-platform via
  `PROVIDER_LIVE_<P>` as approvals land.
- **Why:** Real platform app review takes days–weeks (Meta/TikTok). We must build/test first.

### D-009 OAuth tokens encrypted at rest
- **Decision:** Store tokens AES-256-GCM encrypted (`TOKEN_ENC_KEY`); decrypt only at
  refresh/publish; never log.
- **Why:** Security NFR.

### D-010 Disconnecting an account = soft delete (preserve history)
- **Decision:** Disconnect sets `status` + `disconnectedAt` rather than hard-deleting, so
  posted history / result cards survive. (Revisit if storage becomes an issue.)
- **Why:** Hard delete cascades `PostTarget` history.

### D-011 Frontend UI built with shadcn/ui
- **Decision:** All frontend UI uses **shadcn/ui** (Radix + Tailwind) as the component
  library — every screen composes shadcn primitives (button, card, dialog, tabs, form, etc.);
  no hand-rolled equivalents. Bespoke domain UI (media dropzone, calendar grid, account
  selector) is built *from* shadcn primitives. Theme tokens set to the green-on-light-gray
  design system. Spec: `docs/implementation/14-ui-components.md`.
- **Why:** User direction — clean, consistent, accessible layout with minimal custom CSS;
  components are owned/editable code (not a locked dependency).

## Open questions / to revisit
- Exact annual prices (placeholder yearly values in `plans.ts` — set from real Stripe Prices).
- Downgrade-with-over-limit-accounts UX (block new connects + flag over-limit; confirm copy).
- Trial-expiry behavior (MVP: read-only + subscribe prompt — confirm).
- Whether calendar shows one chip-per-post (stacked icons) or one chip-per-target (chosen:
  one chip per post with stacked platform icons).

# Spanly — Decisions Log

Running log of product + architecture decisions with reasoning. Newest at top. Each entry:
what we decided, why, and any alternative rejected.

---

## 2026-06-12 — Phase 2 decisions

### D-012 Auth: lightweight custom DB-session layer (deviates from NextAuth v5)
- **Decision:** Implement email/password auth with our **own** session layer instead of
  Auth.js/NextAuth v5: bcrypt password hashing, a high-entropy opaque `sessionToken` stored in
  the existing `Session` table, an httpOnly cookie (`spanly_session`) holding only that token,
  and `getCurrentUser()` that validates it against the DB. Edge `middleware.ts` checks **cookie
  presence** only (no Prisma on edge); the `(app)` layout does full DB validation.
- **Why:** Docs `00`/`03` named NextAuth v5, but its **Credentials** provider forces the **JWT**
  session strategy and does not support **database sessions** — which the spec explicitly
  requires so "sign out of all devices" / reset-invalidation work by deleting `Session` rows.
  Forcing DB sessions onto NextAuth Credentials needs fragile, version-sensitive workarounds.
  Our `Session` table already matches this shape, so a small custom layer is cleaner, has fewer
  moving parts, and satisfies every `03` acceptance criterion directly.
- **Rejected:** NextAuth v5 + Prisma adapter with manual DB-session hack (beta churn, fragile).
- **Approved by:** human (2026-06-12, AskUserQuestion).

### D-013 Dev email: console mailer behind a swappable interface
- **Decision:** A `mailer` abstraction with a dev transport that **logs** verify/reset links to
  the server console. Resend (per docs `00`) plugs in behind the same interface once a
  `RESEND_API_KEY` + verified sender exist.
- **Why:** Lets the full auth loop be exercised now with zero email infra; matches `03`'s
  "dev: log link" note. **Rejected:** Mailpit container (extra infra), wiring Resend now (needs
  user-provided key/domain). **Approved by:** human (2026-06-12).

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

### D-014 Billing has a mock mode, mirroring MockProvider
- **Decision:** Billing runs behind `BILLING_MODE=mock|live` (default `mock`), the same
  stand-in pattern as OAuth/publishing (D-008). In mock mode, `checkout`/`portal` redirect to
  internal pages (`/billing/mock/*`) that drive the same `Subscription` upsert logic the live
  Stripe webhook uses — so the full flow (subscribe → 7-day trial → portal → cancel → API
  add-on) is buildable/verifiable with **no Stripe account or Price IDs**. The live path
  (`stripe` SDK + signed `/api/webhooks/stripe`) is wired and switches on when `STRIPE_*` env
  is set. Stripe is the source of truth in live mode; subscriptions upsert idempotently by
  `stripeSubId`.
- **Why:** Platform/Stripe credentials are still a pending human-action item; the mock keeps
  the phase shippable now without blocking on external accounts, exactly like the providers.

### D-015 Downgrade below account count: keep accounts, flag over-limit, block new connects
- **Decision:** If a plan change leaves `active accounts > accountLimit`, existing accounts are
  **kept** (never silently deleted); new connects are blocked by the connect gate (doc 05) and
  the Plans/Billing UI surfaces an "over limit" notice. Helper `isOverAccountLimit(plan,count)`.
- **Why:** Avoids destructive data loss on downgrade; the limit only constrains growth.

### D-016 Refund: record request within 7-day window, no auto-refund in MVP
- **Decision:** "Request Refund" checks the 7-day money-back window; within it we **record the
  request + notify support** (console mailer, D-013) and return a confirmation; outside it we
  deny with a message. No automatic Stripe refund call in MVP (avoids accidental money movement
  in mock/test). Revisit to auto-refund via the Stripe API once live billing is verified.
- **Why:** Keeps refunds safe and auditable before real payments exist.

## Open questions / to revisit
- Exact annual prices (placeholder yearly values in `plans.ts` — set from real Stripe Prices).
- ~~Downgrade-with-over-limit-accounts UX~~ → resolved D-015 (keep + flag, block new connects).
- Trial-expiry behavior (MVP: read-only + subscribe prompt — confirm).
- Whether calendar shows one chip-per-post (stacked icons) or one chip-per-target (chosen:
  one chip per post with stacked platform icons).

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

### D-017 Public API: hashed keys, Bearer auth, add-on gate, HMAC webhooks
- **Decision:** Programmatic access (doc 12) uses opaque keys `spb_live_<48hex>`; we store only
  `sha256(secret)` + a non-secret prefix and last-4, and show the plaintext **once** at creation
  (same one-time-reveal model as verification tokens). Public endpoints live under `/api/v1/*`,
  authenticate via `Authorization: Bearer <key>`, and are gated server-side behind the **API
  add-on** (`requireApiAddon`) — never the UI alone. Post-completion webhooks are per-user, signed
  with **HMAC-SHA256** over the raw body in `X-Spanly-Signature`, delivered **once** per post from
  the publish-runner terminal rollup (idempotent via `Post.webhookSentAt`, best-effort + time-boxed
  so a bad URL never blocks publishing). MVP public surface: `GET /v1/me`, `GET /v1/accounts`,
  `POST /v1/posts` (text); media-in-API deferred.
- **Why:** Mirrors the project's existing security posture (hash-at-rest, server-side gates,
  idempotent delivery) and reuses the posts service so the API can't drift from the app's rules.

### D-018 Bulk import: stateless validate→commit, reuses the composer service (no new model)
- **Decision:** Bulk import (Phase 9) is a **stateless two-step**: `POST /api/bulk/validate` parses
  the CSV into a per-row preview (no writes), then `POST /api/bulk/commit` **re-validates
  server-side** and creates each valid row through the **same** service path as single-post creation
  (`createDraft` → `schedulePost`/`addToQueue`) so per-platform caption/capability limits and the
  future-time rule can't be bypassed. Columns: `caption, type, platforms, date, time, media_url`
  (only `caption`/content structurally required). `platforms` accepts keys **or** labels
  (`twitter`→`x`); empty → the UI's default-account selection. Three modes: **draft** (date/time
  ignored), **schedule** (each row needs date+time, interpreted in the user's `timezone`), **queue**
  (sequential next-open slots). Media-by-URL is **ingested as an external `Media` row** (kind from
  type, `processed:true`) — no upload pipeline. Invalid rows are skipped, not fatal; per-row outcomes
  are returned. A failed dispatch rolls back its orphan draft+media. **No `BulkImport`/history
  model** — committed posts already surface in Posts/Calendar; an import-history table + true
  double-submit idempotency are deferred.
- **Why:** Reusing the composer service keeps bulk from drifting from the app's rules; a stateless
  flow avoids schema churn and ships the feature with zero migration risk. CSV is parsed with a small
  dependency-free reader (`src/lib/csv.ts`) to keep the dependency surface minimal.
- **Rejected:** a `BulkImport` audit model (extra migration; redundant with the normal post lists for
  MVP); a CSV-parsing dependency (unneeded for our column set).

### D-019 MCP server: hand-rolled stateless JSON-RPC over HTTP, reuses API-key auth
- **Decision:** The MCP server (Phase 11) is a single Next route handler at `/api/mcp` speaking
  **JSON-RPC 2.0 over the Streamable-HTTP transport, stateless** — each POST is authenticated by
  API key (the **same** `authorizeApiRequest` Bearer + API-add-on gate as the public v1 API) and
  answered with one JSON response; notifications get `202`; `GET` returns `405` (no server→client
  SSE). We **hand-roll** `initialize`/`tools/list`/`tools/call` (`src/server/mcp.ts`) instead of
  pulling in the MCP SDK + a Node transport. Tools: `list_accounts`, `create_post`,
  `get_post_status` — `create_post` shares `createApiTextPost` (posts.ts) with `POST /api/v1/posts`
  so REST and MCP can't drift. The endpoint URL is surfaced in Settings → General with a link to
  the help guide.
- **Why:** Matches the project's dependency-light posture (cf. custom CSV/auth), keeps the whole
  surface testable over plain `fetch`, and avoids the SDK's Node-transport friction inside Next
  route handlers. Stateless is sufficient for a tool-only server (no subscriptions/sampling).
- **Rejected:** `@modelcontextprotocol/sdk` + Streamable-HTTP transport (transport/runtime friction
  in App Router, heavier dep for three tools); stdio transport (not reachable from a hosted web app).

### D-020 Help center: typed structured content, no MDX/markdown pipeline
- **Decision:** The help center (Phase 13) is **typed data** (`src/lib/help-content.ts`: categories
  + articles as block arrays) rendered by a small block renderer (`ArticleBody`), with a
  client-side search index. Articles are **statically generated** (`generateStaticParams`) under
  `(app)/help` and map 1:1 to shipped features. No MDX/markdown dependency.
- **Why:** Content is small and fully under our control; typed blocks give consistent styling, easy
  client search, and zero new dependency. **Rejected:** MDX/contentlayer (overkill); a CMS (no need
  for non-dev editing at MVP).
- **Update (2026-06-12):** expanded to **7 categories / 36 articles**, modeling topic *coverage* on
  the Post-Bridge support center (support.post-bridge.com) while writing all copy **originally** for
  Spanly (D-001). Deliberately omitted topics that don't apply to Spanly: Bluesky/Threads, magic-link
  login (we use password + email verification), affiliate program, TikTok-music/custom-thumbnails,
  and team/VA account access (Workspaces deferred — D-004). All platform limits in the articles are
  taken from `PLATFORM_CONFIG` so the docs match enforcement.

## Open questions / to revisit
- Exact annual prices (placeholder yearly values in `plans.ts` — set from real Stripe Prices).
- ~~Downgrade-with-over-limit-accounts UX~~ → resolved D-015 (keep + flag, block new connects).
- Trial-expiry behavior (MVP: read-only + subscribe prompt — confirm).
- Whether calendar shows one chip-per-post (stacked icons) or one chip-per-target (chosen:
  one chip per post with stacked platform icons).

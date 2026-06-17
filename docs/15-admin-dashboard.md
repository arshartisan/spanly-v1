# 15 — Admin Dashboard (Platform Administration)

**Screenshots (to capture):**
- `admin-home.png` — admin overview / KPIs
- `admin-users.png` — user list
- `admin-user-detail.png` — single-user drill-down
- `admin-subscriptions.png` — subscriptions + refund queue
- `admin-content.png` — cross-user posts / moderation
- `admin-system.png` — queue & system health
- `admin-settings.png` — feature flags / platform settings

**Depends on:** [00-app-shell-and-navigation.md](00-app-shell-and-navigation.md) (shell
pattern), [11-settings.md](11-settings.md) (subscription/billing model),
[09-connections.md](09-connections.md) (accounts), [12-api-keys.md](12-api-keys.md).
**Implementation:** [implementation/15-admin-foundation-and-access.md](implementation/15-admin-foundation-and-access.md)
through `…21-admin-support-powers.md`.

> This is a **new, platform-level surface** — it is **not** part of the Post-Bridge
> reference. It lives at `/admin`, is visible only to staff (`role` ≥ `support`), and is
> kept architecturally separate from the customer-facing app under `(app)`.

---

## Purpose

A single internal console for **running the business**: see and manage users, oversee
subscriptions and payments, action refunds, moderate content, watch the publish queue and
system health, and flip platform-wide settings — without touching the database or the
Stripe dashboard by hand. Every mutating action is **audit-logged**.

## Access & roles

Four-level `role` on the existing `User` (a staff member is just a user with an elevated
role and logs in normally):

| Role | Can |
|---|---|
| `user` | normal customer; **no** `/admin` access |
| `support` | read everything; standard support actions (resend email, suspend, add notes) |
| `admin` | the above + subscriptions/refunds, content moderation, feature flags |
| `superadmin` | the above + **sensitive powers**: impersonation, manual billing overrides, forced refunds, GDPR delete, granting roles |

Non-staff who hit any `/admin/*` route are redirected to `/dashboard`. The customer app
never renders an "Admin" nav entry for non-staff.

---

## Layout (global admin chrome)

Mirrors the customer shell ([doc 00](00-app-shell-and-navigation.md)) but with a distinct
**admin sidebar** (same orange-glass theme, with a clear "Admin" badge + an "Exit to app"
link back to `/dashboard`):

```
┌──────────────┬──────────────────────────────────────────────┐
│ ADMIN        │  Page title                      [signed-in   │
│ ─ Overview   │                                   staff menu] │
│ ─ Users      │  ┌──────────────────────────────────────────┐ │
│ ─ Subs       │  │  page content (tables, detail panels,    │ │
│ ─ Payments   │  │  KPI cards, charts)                       │ │
│ ─ Content    │  │                                          │ │
│ ─ Connections│  └──────────────────────────────────────────┘ │
│ ─ System     │                                                │
│ ─ Settings   │                                                │
│ ─ Audit log  │                                                │
│ [Exit→app]   │                                                │
└──────────────┴──────────────────────────────────────────────┘
```

A persistent **impersonation banner** appears app-wide whenever a staff member is acting
as a user (see Support powers).

---

## A) Overview / Home (`admin-home.png`)
**Purpose:** the at-a-glance health of the platform.

- **KPI cards:** Total users · Active (signed in ≤30d) · New signups (7d/30d) · MRR ·
  Trialing · Active subs · Past-due · Churn (30d).
- **Charts:** signups over time, MRR over time, posts published per day, plan distribution.
- **Operational tiles:** publish-queue depth, failed jobs (24h), pending refund requests,
  expiring tokens, system health (DB/Redis/storage/providers) — each links to its section.
- **Recent activity:** latest audit-log entries.

## B) Users (`admin-users.png`, `admin-user-detail.png`)
**Purpose:** find any user and manage their account.

- **List:** search (email / name / id), filters (role, plan, subscription status, verified,
  suspended, signup-date range, last-active), sortable, paginated. Row shows email, plan +
  status badge, # connected accounts, # posts, created, last active.
- **Detail tabs:**
  - *Profile* — email, name, avatar, timezone, verified, role, suspended state, created.
  - *Subscription* — plan/interval/status, trial end, period end, API add-on, Stripe IDs
    (link out), manual-override actions (Phase C/G).
  - *Connections* — connected social accounts, status, token expiry, force-disconnect.
  - *Posts* — recent posts + statuses (link to content moderation).
  - *Sessions* — active sessions; **sign out all devices**.
  - *Activity / Notes* — audit entries for this user + free-text **support notes**.
- **Actions:** suspend / unsuspend, force email-verify, send password-reset, edit
  display name / email, change role *(superadmin)*, **impersonate** *(superadmin)*,
  **delete / anonymize** *(superadmin)*.

## C) Subscriptions & Payments (`admin-subscriptions.png`)
**Purpose:** oversee revenue and handle billing exceptions.

- **Subscriptions list:** filter by status (`trialing|active|past_due|paused|canceled`),
  plan, interval; columns plan, status, trial/period end, MRR contribution.
- **Refund-request queue:** pending requests (user, amount, reason, days-since-charge);
  **Approve & refund / Deny** *(admin; forced/out-of-policy = superadmin)*.
- **Payments / invoices:** recent charges & invoices (from Stripe), status, amount; link to
  the Stripe object. Past-due / dunning list.
- **Manual overrides** *(superadmin, audited):* change plan, extend trial, grant
  comp/credit, cancel subscription.
- **Plan catalog:** view/edit the 3 plans (name, monthly/yearly price, account limit,
  features, trial length, refund window). DB-backed (migrated from `src/server/plans.ts`).
- **Metrics:** MRR, ARPU, churn, trial→paid conversion, plan mix.

## D) Content & Connections (`admin-content.png`)
**Purpose:** platform-wide oversight of what is being published.

- **Posts:** cross-user list, filter by status / platform / date / user; detail shows
  caption, media, targets + per-target results. **Cancel scheduled** / **takedown**
  (cancel pending targets + mark post removed) — audited.
- **Connections:** all connected accounts across users; filter by platform / status; token
  health (expiring/expired); **force-disconnect** a problem account.
- **Moderation note:** Spanlyfy does not host published content (it relays to platforms), so
  moderation = preventing *scheduled* sends and disconnecting abusive accounts, not editing
  already-published posts.

## E) System & Operations (`admin-system.png`)
**Purpose:** keep publishing healthy.

- **Queue monitor (BullMQ):** depth per queue (`publish`/`media`/`maintenance`),
  active/waiting/delayed/failed counts; failed-job list with error + **retry** / **remove**.
- **Maintenance controls:** trigger `missed-run-sweep`, `drafts-cleanup`,
  `token-refresh-sweep` on demand; show last-run + result.
- **System health:** DB, Redis, object storage, each provider — green/red (extends
  `/api/health`).
- **Failed-publish dashboard:** posts/targets that exhausted retries, grouped by platform &
  error class.

## F) Platform Settings & Feature Flags (`admin-settings.png`)
**Purpose:** change platform behavior without a deploy.

- **Feature flags / kill switches:** signups on/off, publishing on/off, per-platform
  enable/disable, content-studio/bulk/API toggles.
- **Maintenance mode:** banner + optional read-only lock.
- **Announcement banners:** message, severity, audience, active window — shown in the
  customer app.
- **Defaults:** trial length, refund window, account-limit overrides (feed the gates in
  `plans.ts`/connections).

## G) Audit log
**Purpose:** accountability. Every mutating admin action writes an immutable entry (actor,
action, target, before/after metadata, IP, timestamp). Filterable by actor / action /
target / date. Source of truth for the sensitive Phase-G powers.

---

## Suggested data model (deltas only — full Prisma in implementation/15)

```ts
enum Role { user support admin superadmin }
// User += role: Role @default(user), suspendedAt: DateTime?

AuditLog       { id, actorId, action, targetType, targetId?, metadata Json, ip?, createdAt }
RefundRequest  { id, userId, subscriptionId?, amount, reason, status, decidedById?, decidedAt?, createdAt }
SupportNote    { id, userId, authorId, body, createdAt }
FeatureFlag    { key, enabled, value Json?, updatedById, updatedAt }   // also platform settings
Announcement   { id, message, severity, audience, startsAt?, endsAt?, active }
Plan           { key, name, monthly, yearly, accountLimit, features Json, trialDays, refundDays }  // Phase C
```

## API namespace
All admin endpoints live under **`/api/admin/*`**, gated by `requireRole()`, Zod-validated,
and audited on mutation. See each implementation doc for exact signatures. Read views are
React Server Components querying Prisma directly under the `(admin)` layout gate.

## Notes for the clone
- Build at `/admin` behind a `role`-based gate reusing the existing DB-session auth — do
  **not** stand up a second auth system.
- Reuse `shadcn/ui` + the orange-glass theme; the admin shell is a sibling of the customer
  shell, not a fork of it.
- Enforce permissions **server-side** in every handler — never rely on hidden nav alone.
- Sensitive powers (impersonation, manual billing, GDPR delete) are `superadmin`-only and
  always audited; they ship last (Phase G).

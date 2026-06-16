# 20 — Admin: Platform Settings & Feature Flags

**Design refs:** `../15-admin-dashboard.md` (F — Platform Settings & Feature Flags).
**Depends on:** `15-admin-foundation-and-access.md`, `05-connections.md` (per-platform
gating), `10-billing-and-plans.md` (trial/refund/limit defaults).
**Build phase:** Phase 9 · **Permissions:** view = `admin`; change = `admin`
(maintenance-mode + global kill switches = `superadmin`).

## Scope
Change platform behavior **without a deploy**: feature flags / kill switches, maintenance
mode, customer-facing announcement banners, and tunable defaults (trial length, refund
window, per-platform availability). A single DB-backed settings store read by both the
admin UI and the customer app's gates.

## Data model (deltas)
```prisma
model FeatureFlag {
  key         String   @id     // "signups", "publishing", "platform.instagram", "api", ...
  enabled     Boolean  @default(true)
  value       Json?            // optional structured config
  description String?
  updatedById String?
  updatedAt   DateTime @updatedAt
}

model Announcement {
  id        String    @id @default(cuid())
  message   String
  severity  String    @default("info")   // info | warning | critical
  audience  String    @default("all")    // all | trialing | plan:<key>
  startsAt  DateTime?
  endsAt    DateTime?
  active    Boolean   @default(true)
  createdById String?
  createdAt DateTime  @default(now())
}
```
- Seed a known set of flags on first migration (signups, publishing, per-platform ×6,
  content-studio, bulk, api, maintenance-mode). Unknown keys default to "enabled" so a
  missing row never blocks the product.

## Settings store (`src/server/settings/flags.ts`)
```ts
export async function isEnabled(key: string): Promise<boolean>   // cached, default true
export async function getFlag(key: string): Promise<FeatureFlag | null>
export async function setFlag(key, enabled, value?, actorId?): Promise<void>  // + audit
export async function activeAnnouncements(user): Promise<Announcement[]>
```
- Cache flags in-process with a short TTL (or Redis) so reads are cheap; invalidate on write.

## Where flags are enforced (server-side, reuse existing gates)
- **`signups`** — checked in `/api/auth/signup` (reject when off).
- **`publishing`** — checked in `publishTarget` / enqueue (when off, hold jobs or skip with
  a "publishing paused" target error).
- **`platform.<name>`** — checked in `/api/connect/:platform/start` and in the composer's
  eligible-platform list (reuse the account-limit gate site in `src/server/connections.ts`).
- **`api`**, **`bulk`**, **`content-studio`** — gate the corresponding feature entry points.
- **`maintenance-mode`** — middleware/layout shows a banner and optionally returns read-only
  for customer mutations (superadmin-only toggle).
- **Defaults** (trial/refund/limit) — feed `getPlans()` / `requirePlan()` from Phase C.

## Announcements (customer app integration)
- The customer `(app)` layout fetches `activeAnnouncements(user)` and renders a dismissible
  banner (audience + active-window filtered). Reuse the orange-glass alert styling.

## Pages
```
src/app/(admin)/admin/settings/page.tsx          // flags + defaults — RSC + client toggles
src/app/(admin)/admin/settings/announcements/page.tsx
src/components/admin/settings/FlagToggle.tsx      // "use client"
```

## API (`/api/admin/settings/*` — `requireRole` + Zod + audit)
```
GET   /api/admin/settings/flags                                  (admin)
PATCH /api/admin/settings/flags/:key   { enabled, value? }       (admin; maintenance-mode=superadmin)
GET   /api/admin/settings/announcements                          (admin)
POST  /api/admin/settings/announcements { message, severity, audience, startsAt?, endsAt? } (admin)
PATCH /api/admin/settings/announcements/:id                      (admin)
DELETE /api/admin/settings/announcements/:id                     (admin)
```
Every change calls `logAdminAction()` (`flag.update`, `announcement.create`, …) with
before/after.

## Edge cases
- A missing/unknown flag must **default to enabled** — never let an absent row silently
  break signup or publishing.
- Turning `publishing` off should not lose scheduled posts — hold/resume, don't drop them
  (decide hold-vs-fail and record in `DECISIONS.md`).
- Cache staleness: enforce a short TTL + write-time invalidation so a kill switch takes
  effect quickly.
- Maintenance mode must still allow **staff** to use `/admin`.

## Acceptance criteria
- Toggling `signups` off blocks new signups with a clear message; on restores them.
- Disabling `platform.tiktok` removes it from connect options and blocks new TikTok connects.
- An active announcement appears in the customer app for its audience and window.
- All changes are audited; unknown flag keys default to enabled.

## Verification
1. Toggle `signups` off → `/signup` (or its API) rejects; toggle on → works again.
2. Disable `platform.instagram` → Instagram connect is unavailable; `AuditLog` records it.
3. Create an announcement for `audience=all` with a current window → it shows in the app;
   set `endsAt` in the past → it disappears.
4. Enable maintenance mode (superadmin) → customers see the banner; staff still reach `/admin`.

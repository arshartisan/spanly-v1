# 15 — Admin: Foundation & Access Control

**Design refs:** `../15-admin-dashboard.md` (Access & roles, Overview, Audit log).
**Depends on:** `01` (User/Subscription), `03` (auth + sessions), `04` (app shell/nav).
**Build phase:** Phase 9 (Administration) · **Permissions:** `support`+ to view; role
changes are `superadmin`.

## Scope
The platform that every other admin phase builds on: a `role` on `User`, server-side role
gating that reuses the existing DB-session auth, the `(admin)` route group + shell + nav,
the admin **Overview** (KPIs), and the `AuditLog` model + `logAdminAction()` helper. **No
sensitive powers here** — just read access, the shell, and the audit spine.

## Data model (Prisma deltas — `prisma/schema.prisma`)
```prisma
enum Role { user support admin superadmin }

model User {
  // …existing fields…
  role        Role      @default(user)
  suspendedAt DateTime?
  auditLogs   AuditLog[]   @relation("AuditActor")
  supportNotes SupportNote[] @relation("NoteAuthor")
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  actor      User     @relation("AuditActor", fields: [actorId], references: [id])
  action     String   // e.g. "user.suspend", "refund.approve", "user.impersonate"
  targetType String?  // "user" | "subscription" | "post" | "account" | "flag" | ...
  targetId   String?
  metadata   Json?    // before/after, reason, amounts — never secrets/tokens
  ip         String?
  createdAt  DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
}
```
> Migration sets `role` to `user` for all existing rows. Seed/promote the first
> `superadmin` via a one-off script or `prisma db seed` (do **not** expose a self-promote
> route). Record this in `DECISIONS.md`.

## Role gating (`src/server/admin/access.ts` — mirror `requirePlan` in `plans.ts`)
```ts
import { getCurrentUser } from "@/server/auth";

const RANK: Record<Role, number> = { user: 0, support: 1, admin: 2, superadmin: 3 };
export function roleAtLeast(role: Role, min: Role) { return RANK[role] >= RANK[min]; }

// For RSC/layouts: returns staff user or redirects.
export async function requireStaff(min: Role = "support") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roleAtLeast(user.role, min)) redirect("/dashboard");
  return user;
}

// For /api/admin handlers: returns user or throws a 401/403 Response.
export async function requireRole(min: Role) {
  const user = await getCurrentUser();
  if (!user) throw forbidden(401);
  if (!roleAtLeast(user.role, min)) throw forbidden(403);
  return user;
}
```
- Extend `CurrentUser` in `src/server/auth.ts` so `getCurrentUser()` returns `role` and
  `suspendedAt` (already selects the User row — add the fields).
- Add `"/admin"` to `PROTECTED_PREFIXES` in `src/middleware.ts` (cookie-presence gate only;
  the real role check is the layout below — middleware runs on the edge with no DB).

## Routes & pages
```
src/app/(admin)/
  layout.tsx                  // requireStaff(); renders <AdminSidebar/> + impersonation banner
  admin/
    page.tsx                  // Overview (KPIs) — RSC
src/components/admin/
  AdminSidebar.tsx            // mirrors shell/Sidebar.tsx, driven by ADMIN_NAV
  KpiCard.tsx, AdminTable.tsx // shared shadcn-based primitives reused by later phases
src/lib/admin-nav.ts          // ADMIN_NAV config (Overview, Users, Subs, …)
src/server/admin/
  access.ts                   // role helpers (above)
  audit.ts                    // logAdminAction()
  metrics.ts                  // KPI queries for Overview
src/app/api/admin/            // (handlers added per later phase)
```
`src/app/(admin)/layout.tsx` mirrors `src/app/(app)/layout.tsx`: `const staff = await
requireStaff()` then render the admin shell. The customer `Sidebar` shows an "Admin" link
**only** when `roleAtLeast(user.role, "support")`.

## Audit helper (`src/server/admin/audit.ts`)
```ts
export async function logAdminAction(input: {
  actorId: string; action: string;
  targetType?: string; targetId?: string;
  metadata?: Record<string, unknown>; ip?: string;
}) {
  await prisma.auditLog.create({ data: { ...input, metadata: input.metadata ?? {} } });
}
```
**Rule:** every mutating `/api/admin/*` handler calls `logAdminAction()` after a successful
change. Reads are not logged (except impersonation start — Phase G).

## Overview metrics (`src/server/admin/metrics.ts`)
Aggregate queries for the KPI cards/charts: counts by `Subscription.status`, new users by
`createdAt` window, active users by latest `Session`, posts published per day, plan mix.
MRR/churn computed from `Subscription` (+ optionally reconciled with Stripe in Phase C).

## Edge cases
- A suspended **staff** member loses admin access (gate also checks `suspendedAt`).
- Self-actions: an admin cannot change their **own** role or suspend themselves (guard).
- Middleware can't see role on the edge → never treat the cookie gate as authorization; the
  `(admin)` layout is the real gate.
- Demoting the last `superadmin` is blocked.

## Acceptance criteria
- A `user`-role account visiting `/admin` is redirected to `/dashboard`; a `support`+
  account sees the Overview.
- `getCurrentUser()` returns `role`; `requireRole("admin")` returns 403 for `support`.
- Overview renders real KPI numbers from the DB.
- Promoting a user to `superadmin` writes an `AuditLog` row.

## Verification
1. Seed one `superadmin`; log in → `/admin` loads with KPIs. Log in as a normal user →
   `/admin` redirects to `/dashboard`.
2. `curl` an admin API as a non-staff session → 403; as staff → 200.
3. Suspend a staff member in DB → their `/admin` access is revoked on next request.
4. Inspect `AuditLog` after a role change — actor, action, target, metadata present.

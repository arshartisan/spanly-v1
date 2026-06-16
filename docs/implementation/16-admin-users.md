# 16 — Admin: User Management

**Design refs:** `../15-admin-dashboard.md` (B — Users).
**Depends on:** `15-admin-foundation-and-access.md` (role gate + audit), `03` (auth/sessions
helpers), `01` (User/Subscription/SocialAccount/Post).
**Build phase:** Phase 9 · **Permissions:** view = `support`; edit/suspend = `support`;
edit email & role = `admin`+ (role change = `superadmin`, see Phase G).

## Scope
Find any user and run **standard** account actions. No impersonation, no manual billing,
no delete here — those are Phase G. Reuses existing auth utilities so we don't reinvent
session/token logic.

## Pages
```
src/app/(admin)/admin/users/page.tsx          // list (search/filter/paginate) — RSC
src/app/(admin)/admin/users/[id]/page.tsx     // detail with tabbed panels — RSC
src/components/admin/users/UserFilters.tsx     // "use client" filter/search bar
src/components/admin/users/UserActions.tsx     // "use client" action buttons (calls API)
src/components/admin/users/SupportNotes.tsx    // notes list + add
src/server/admin/users.ts                      // query + mutation service layer
```

### List (`/admin/users`)
- **Search:** email / display name / id. **Filters:** role, plan, subscription status,
  `emailVerified`, `suspended`, signup-date range, last-active. **Sort + paginate**
  (cursor or `skip/take`).
- Columns: email, name, role badge, plan + status, # active accounts, # posts, created,
  last active. Reuse `AdminTable` from Phase A.
- Query helper `listUsers(filter)` in `src/server/admin/users.ts` (Prisma `where` built
  from validated query params; counts via `_count` on relations).

### Detail (`/admin/users/[id]`)
Tabs (all read from Prisma in the RSC):
- **Profile** — email, name, avatar, timezone, `emailVerified`, role, `suspendedAt`, created.
- **Subscription** — read-only summary (manage in Phase C/G); link to Stripe customer.
- **Connections** — `SocialAccount[]` with status + token expiry (manage in Phase D).
- **Posts** — recent `Post[]` + statuses (manage in Phase D).
- **Sessions** — active `Session[]`; **Sign out all devices**.
- **Activity / Notes** — `AuditLog` where `targetId = user.id` + `SupportNote[]`.

## Data model (delta)
```prisma
model SupportNote {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  authorId  String
  author    User     @relation("NoteAuthor", fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}
```

## API (`/api/admin/users/*` — `requireRole` + Zod + audit)
```
GET   /api/admin/users?query=&role=&plan=&status=&suspended=&cursor=   (support)
GET   /api/admin/users/:id                                            (support)
POST  /api/admin/users/:id/suspend     { reason }                     (support) → user.suspendedAt=now
POST  /api/admin/users/:id/unsuspend                                  (support)
POST  /api/admin/users/:id/verify-email                               (support) → emailVerified=true
POST  /api/admin/users/:id/send-reset                                 (support) → issueToken + mailer
POST  /api/admin/users/:id/signout-all                               (support) → destroyAllSessions(id)
PATCH /api/admin/users/:id           { displayName?, email? }         (admin)
POST  /api/admin/users/:id/notes      { body }                        (support)
```
**Reuse, don't reinvent:** `destroyAllSessions(userId)`, `issueToken(...)` /
password-reset flow, and `mailer` all already exist in `src/server/auth.ts` /
`src/server/mailer.ts` — the admin handlers call them with the target user's id. Every
mutation calls `logAdminAction()`.

## Effects of suspension
- `suspendedAt` set → block login (check in auth/login flow) and pause publishing for that
  user's scheduled targets (skip in `publishTarget`, or cancel pending jobs). Decide & note
  in `DECISIONS.md`; the simplest MVP: block new login + new publishes, leave queued jobs to
  no-op on a suspended owner.

## Edge cases
- Changing email here should **not** silently break their login — either set the new email
  directly (verified) or trigger the existing change-email verification; pick one and audit.
- Suspending a user with scheduled posts: surface the count in the confirm dialog.
- An admin cannot suspend a `superadmin` (rank guard); nobody can suspend themselves.

## Acceptance criteria
- List filters + search return correct, paginated results.
- Suspend → user can't log in; unsuspend restores access; both audited.
- "Sign out all devices" invalidates the target's sessions (reuses `destroyAllSessions`).
- "Send reset" emails a working reset link to the target.
- Support notes persist and show on the detail Activity tab.

## Verification
1. Create test users on different plans/statuses; confirm each filter narrows the list.
2. Suspend a test user → attempt login → blocked; check `AuditLog` for `user.suspend`.
3. Trigger "Send reset" → reset email arrives (console mailer in dev) with a valid token.
4. Add a support note → appears on the user's Activity tab with author + timestamp.

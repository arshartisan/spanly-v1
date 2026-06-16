# 21 — Admin: Advanced Support Powers (superadmin)

**Design refs:** `../15-admin-dashboard.md` (B/C — Users & Subscriptions; G — Audit).
**Depends on:** `15-admin-foundation-and-access.md` (role gate + audit), `16-admin-users.md`,
`17-admin-subscriptions-billing.md`, `03` (sessions).
**Build phase:** Phase 9 (last) · **Permissions:** **`superadmin` only**, every action
audited. Ships after all read/manage phases are stable.

## Scope
The small set of high-blast-radius powers used for hands-on support, deliberately isolated:
**user impersonation**, **manual billing overrides** (plan/credit/forced refund — handlers
defined in Phase C, exposed here), **broadcast email**, and **GDPR delete / anonymize**.
Each is `superadmin`-gated, confirmed with a typed reason, and written to `AuditLog`.

## 1) User impersonation ("log in as user")
**Purpose:** reproduce a customer's exact view to debug.

- **Mechanism:** issue a short-lived impersonation session that records both the **acting
  staff id** and the **target user id**, separate from a normal session. Reuse the
  session machinery in `src/server/auth.ts` — add an `impersonatorId` to the `Session`
  row (or a parallel `ImpersonationSession`) rather than overwriting the staff session.

```prisma
model Session {
  // …existing…
  impersonatorId String?   // staff user id when this session is an impersonation
}
```

- **Flow:** `POST /api/admin/users/:id/impersonate` (superadmin) → create impersonation
  session for the target → redirect to `/dashboard`. A persistent **banner** ("You are
  viewing as <email> — Exit") renders app-wide whenever `impersonatorId` is set.
  `POST /api/admin/impersonate/stop` restores the staff session.
- **Guardrails:** impersonation is **read/act-as-user** but **blocks destructive billing
  actions** while impersonating; cannot impersonate another `superadmin`; max TTL (e.g.
  30 min); **start and stop are both audited** (`user.impersonate.start/stop`). Never used
  to change the target's password or email.

## 2) Manual billing overrides (handlers from Phase C)
Exposed here under superadmin with extra confirmation:
- **Change plan / extend trial / change status** — `POST /api/admin/users/:id/subscription`.
- **Grant credit / comp** — `POST /api/admin/users/:id/credit`.
- **Forced refund** (outside the `refundDays` window) — the Phase C refund-approve handler
  with an `out_of_policy=true` flag; requires superadmin and a reason.
- Honor `BILLING_MODE` (mock = local `Subscription` update; live = Stripe + webhook
  reconcile), idempotent, audited with before/after + amounts.

## 3) Broadcast / transactional email
**Purpose:** notify a segment (e.g. "publishing degraded", "price change").
- `POST /api/admin/broadcast { audience, subject, body }` (superadmin). `audience` = all /
  trialing / `plan:<key>` / explicit ids. Sends via the existing `src/server/mailer.ts`
  (queue the sends through BullMQ to avoid blocking; reuse the worker).
- Audited (`broadcast.send` with audience + recipient count). Respect users'
  email-preference opt-outs where applicable.

## 4) GDPR delete / anonymize
**Purpose:** honor erasure requests.
- `POST /api/admin/users/:id/anonymize` (superadmin) — scrub PII (email→hashed
  placeholder, name, avatar), revoke sessions/api-keys, soft-delete connections, keep
  aggregate/financial records as required. Preferred over hard-delete to preserve
  referential integrity and audit history.
- `DELETE /api/admin/users/:id` (superadmin) — hard delete only when legally required;
  cascade per Prisma relations; **cannot** delete a user with an active paid subscription
  until it's canceled (guard). Always audited (`user.anonymize` / `user.delete`).

## Permissions & audit (cross-cutting)
- Every endpoint in this doc calls `requireRole("superadmin")` and `logAdminAction()`.
- Audit metadata captures actor, target, reason, before/after, and for impersonation the
  full start→stop span. The audit log is **append-only** — no admin endpoint edits or
  deletes `AuditLog` rows.
- A `superadmin` cannot run these against **themselves** or another `superadmin` (rank
  guard), and cannot self-grant.

## Edge cases
- Impersonation session must not leak into the real staff session on logout; "Exit" always
  returns to the staff identity.
- Forced refund after multiple charges → pick the charge explicitly; never guess.
- Anonymize must also purge encrypted OAuth tokens and any cached PII; never log them.
- Broadcast to a huge audience → chunk through the queue; show progress, allow cancel.

## Acceptance criteria
- A `superadmin` can impersonate a non-admin user, sees the banner, acts as them, and exits
  cleanly back to their staff identity; start + stop are audited.
- An `admin` (non-super) cannot access any endpoint in this doc (403).
- Forced/out-of-policy refund works only for superadmin and is flagged in the audit.
- Anonymize scrubs PII and revokes access while preserving audit/financial records.

## Verification
1. As superadmin, impersonate a test user → `/dashboard` shows their data + the banner →
   Exit → back to staff. Check `AuditLog` for start and stop.
2. As `admin`, call `/api/admin/users/:id/impersonate` → 403.
3. Issue a forced refund (mock mode) outside the window → succeeds for superadmin, audited
   `out_of_policy=true`; the same call as `admin` is denied.
4. Anonymize a test user → email/name scrubbed, sessions + api-keys revoked, audit row
   present; attempting it on a paid-active user is blocked until canceled.

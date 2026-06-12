# 03 — Authentication

**Design refs:** `../00-app-shell-and-navigation.md`, `../11-settings.md` (Section A).
**Depends on:** `01` (User, Session, VerificationToken), `00` (Auth.js).

## Scope (MVP)
Email/password auth with verified email, password reset, durable sessions, and
"sign out of all devices". No social login for app auth (social OAuth is for *connecting
posting accounts*, doc 05 — keep the two concepts separate).

## Screens / routes
| Route | Purpose |
|---|---|
| `/(auth)/signup` | Create account (email, password, display name). |
| `/(auth)/login` | Email + password. |
| `/(auth)/forgot` | Request reset link. |
| `/(auth)/reset?token=` | Set new password. |
| `/(auth)/verify?token=` | Confirm email. |
| `/api/auth/[...nextauth]` | Auth.js handler (Credentials + DB sessions). |

## Implementation
- **Auth.js (NextAuth v5)** with the **Credentials** provider + **Prisma adapter**, DB
  session strategy (so we can invalidate sessions server-side).
- Password hashing: **bcrypt** (cost 12) or argon2. Store in `User.passwordHash`.
- `src/server/auth.ts` exports `auth`, `signIn`, `signOut`, and a `getCurrentUser()` helper.
- **Middleware** (`src/middleware.ts`): protect `/(app)/*`; redirect unauthenticated →
  `/login`. Allow `/(auth)/*`, `/(marketing)/*`, `/api/auth/*`, `/api/webhooks/*`.

### Signup flow
1. Validate with Zod (`email`, `password` ≥ 8, `displayName`).
2. Reject if email exists. Hash password. Create `User` + default `Subscription`
   (plan=creator, status=trialing, trialEndsAt=now+7d) + default `QueueSettings`.
3. Create `VerificationToken(type='verify_email')`, email the link (Resend).
4. Sign the user in (email-unverified allowed to browse, but publishing can warn until
   verified — keep simple in MVP: allow).

### Password reset
1. `/forgot` → always respond 200 (don't leak which emails exist). If user exists, create
   `VerificationToken(type='reset_password', expires=+1h)`, email link.
2. `/reset` → validate token (unused + unexpired), set new hash, mark token used, invalidate
   all sessions for that user.

### Sign out all devices (doc 11A "Security")
- Delete all `Session` rows for the user → forces re-login everywhere.

## Settings → General actions wired here (doc 11A)
- Change display name → `PATCH /api/settings` .
- Change email → re-verify flow (new `verify_email` token to new address).
- Change password → requires current password; re-hash.
- Forgot password (in-app) → triggers reset email.
- Sign out all devices → deletes sessions.

## Validation schemas (`src/lib/schemas/auth.ts`)
```ts
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string() });
export const resetSchema = z.object({ token: z.string(), password: z.string().min(8).max(72) });
```

## Edge cases
- Duplicate signup email → 409, friendly message.
- Expired/used reset token → invalid, prompt to request again.
- Rate-limit `/login`, `/forgot` (e.g. 5/min/IP) to deter brute force.
- bcrypt 72-byte cap → enforce `password.max(72)`.
- Timing: compare against a dummy hash when user not found (avoid user enumeration).

## Acceptance criteria
- Can sign up, receive verify email (dev: log link / Mailpit), log in, log out.
- Reset flow sets a new password and invalidates old sessions.
- Unauthenticated access to any `/(app)/*` route redirects to `/login`.
- "Sign out all devices" invalidates the current session too.

## Verification
1. Sign up → confirm `User` + trialing `Subscription` + `QueueSettings` created.
2. Open an incognito session, log in as same user (2 sessions). Click "Sign Out All
   Devices" in one → both are logged out.
3. Request reset, use link, log in with new password; reused link now fails.

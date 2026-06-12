# 12 — API Surface (Contract)

**Depends on:** all feature docs. This is the canonical list of route handlers for MVP. All
under `src/app/api/`. Every handler (except auth + Stripe webhook) **requires a session** and
**scopes queries to the current user**. All inputs validated with Zod.

> Conventions: JSON in/out; errors `{ error: { code, message, fields? } }`; 2xx success;
> 401 unauthenticated; 403 plan-gated; 409 conflict; 422 validation.

## Auth (doc 03)
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/auth/[...nextauth]` | — | Auth.js (login/logout/session) |
| POST | `/api/auth/signup` | `{email,password,displayName}` | create user + trial sub |
| POST | `/api/auth/forgot` | `{email}` | always 200 |
| POST | `/api/auth/reset` | `{token,password}` | reset + invalidate sessions |
| POST | `/api/auth/verify` | `{token}` | mark email verified |

## Settings (doc 11)
| Method | Path | Body |
|---|---|---|
| GET | `/api/settings` | — |
| PATCH | `/api/settings` | partial settings |
| POST | `/api/settings/email/change` | `{newEmail}` |
| POST | `/api/settings/password/change` | `{current,next}` |
| POST | `/api/settings/signout-all` | — |
| GET / PUT | `/api/queue` | `{timezone,randomizeWithinMinutes,slots[]}` |

## Connections (doc 05)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/accounts` | grouped by platform |
| GET | `/api/connect/[platform]/start` | `?method=` for IG; 302 to provider/mock |
| GET | `/api/connect/[platform]/callback` | stores tokens, creates account |
| POST | `/api/accounts/[id]/refresh` | refresh tokens |
| DELETE | `/api/accounts/[id]` | soft-delete |

## Media (doc 06)
| Method | Path | Body |
|---|---|---|
| POST | `/api/media/presign` | `{filename,mimeType,sizeBytes}` → presigned PUT |
| POST | `/api/media/finalize` | `{mediaId,width,height,durationSec}` |

## Posts (doc 06/07/09)
| Method | Path | Body / Notes |
|---|---|---|
| GET | `/api/posts` | filters: `status,platform,type,account,range,sort,cursor` |
| GET | `/api/posts/calendar` | `from,to,platform` → chips |
| POST | `/api/posts` | create draft |
| GET | `/api/posts/[id]` | post + targets (used by publish polling) |
| PATCH | `/api/posts/[id]` | update fields |
| DELETE | `/api/posts/[id]` | |
| POST | `/api/posts/[id]/publish` | post now → enqueue jobs |
| POST | `/api/posts/[id]/schedule` | `{publishAt,timezone}` |
| POST | `/api/posts/[id]/queue` | next open slot |
| POST | `/api/posts/[id]/duplicate` | clone to draft |
| POST | `/api/posts/[id]/targets/[targetId]/retry` | retry one failed target |
| GET | `/api/captions/recent` | Past Captions |

## Billing (doc 10)
| Method | Path | Body |
|---|---|---|
| GET | `/api/billing` | current subscription |
| GET | `/api/plans` | plan catalog |
| POST | `/api/billing/checkout` | `{plan,interval}` |
| POST | `/api/billing/portal` | — |
| POST | `/api/billing/addons/api` | `{enable}` |
| POST | `/api/billing/refund` | — |
| POST | `/api/webhooks/stripe` | Stripe signed (no session) |

## System
| Method | Path |
|---|---|
| GET | `/api/health` | DB + Redis check |

## Shared Zod schemas (`src/lib/schemas/`)
- `auth.ts`, `post.ts`, `account.ts`, `media.ts`, `queue.ts`, `billing.ts`, `settings.ts`.
- Reused on both client (form validation) and server (handler validation).

## Acceptance criteria
- Every handler validates input and enforces ownership + auth.
- Plan-gated routes (`/connect/start`) return 403 with an upgrade hint when over limit.
- Response shapes match what the UI docs consume (targets include per-platform status).

## Verification
- Contract test per handler: unauthenticated → 401; invalid body → 422; happy path → 2xx with
  the documented shape. (See doc 13.)

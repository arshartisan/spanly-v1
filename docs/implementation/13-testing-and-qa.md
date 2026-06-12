# 13 — Testing & QA

**Depends on:** all docs. Defines the test strategy, per-phase acceptance gates, edge cases,
and manual verification so each milestone has a human checkpoint.

## Test stack
- **Unit:** Vitest — pure logic (plan limits, slot computation, provider.validate, status
  rollup, token crypto).
- **Integration:** Vitest + a test Postgres (Testcontainers or a disposable schema) +
  MockProvider — services & API handlers.
- **E2E:** Playwright — critical user journeys against the running app with mock providers.
- **Contract:** per-handler tests asserting auth/validation/shape (doc 12).
- CI runs unit + integration on every push; E2E on PR.

## What to test where
| Layer | Examples |
|---|---|
| Unit | `nextSlot()` honors days/tz/randomize; caption min-limit; `recomputePostStatus`; AES encrypt/decrypt round-trip; plan `accountLimit`. |
| Integration | connect (mock) creates account; schedule creates N targets w/ unique idempotency keys; worker publish updates targets; account-limit gate; Stripe webhook upserts subscription (mock event). |
| E2E | signup→login; connect 6 mocks; compose+schedule; worker publishes; result cards; retry failed; billing checkout (Stripe test). |

## Critical edge cases (must have tests)
- **Idempotency:** double-submit / worker restart never double-posts (jobId + status check).
- **Partial failure:** one target fails (MOCK_FAIL_PLATFORMS) → post `failed`, others success,
  retry fixes only the failed one.
- **Token expiry:** expired token at publish → refresh path; unrecoverable → account `expired`
  + target failed + reconnect prompt.
- **Timezone/DST:** schedule across a DST boundary lands on the right local time.
- **Validation:** over-limit caption per platform blocks that target; story requires exactly
  one media; video duration/bytes caps.
- **Plan gating:** connect beyond limit → 403; downgrade with over-limit accounts handled per
  decision.
- **Missed runs:** Redis down during scheduled window → maintenance sweep recovers.
- **Auth:** session invalidation on "sign out all devices" + password reset.
- **Drafts cleanup:** 90-day-old drafts removed.

## Per-phase acceptance gates (human checkpoints)
| Phase | Gate (manual + automated) |
|---|---|
| Foundation (`00–02`) | app+worker boot; migrate+seed; mock connect→publish smoke passes. |
| Auth & shell (`03–04`) | full auth lifecycle; protected routing; shell on all pages. |
| Connections (`05`) | 6 mock accounts connect/refresh/disconnect; limit gate; encrypted tokens. |
| Composer (`06`) | all 4 types; per-platform captions; media upload; validation. |
| Scheduling/lists/calendar (`07–08`) | schedule→publish on time; lists+badges; calendar tz; queue slots. |
| Publishing (`09`) | progress→results; retry; survive navigation. |
| Billing (`10–11`) | checkout/trial/portal/cancel; gating live. |

Each gate = automated tests green **and** the manual "Verification" steps in the relevant doc
performed by the human. Update `../../PROGRESS.md` and stop for sign-off before the next phase.

## Manual QA script (smoke, end-to-end, mock mode)
1. Sign up → land on dashboard empty state.
2. Connect all 6 platforms via mock Allow pages.
3. Create an image post to IG+X+LinkedIn, add a LinkedIn caption override, upload 1 image.
4. "Post now" → progress → result cards (set MOCK_FAIL_PLATFORMS=x to see a failure + retry).
5. Create a second post, "Schedule" 1 min out → appears in Scheduled + Calendar → worker
   publishes → moves to Posted.
6. Configure queue slots; "Add to queue" a third post → verify slot landing.
7. Settings: toggle prefs, change password, sign out all devices.
8. Billing (Stripe test): subscribe Creator → trial badge; open portal; cancel.

## Acceptance criteria (for this doc's process)
- CI is green (unit+integration) before any phase is marked done.
- Each phase's manual verification steps are reproducible by the human in <15 min.
- No phase advances with failing tests or partial implementation.

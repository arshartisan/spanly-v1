# 10 — Billing & Plans

**Design refs:** `../11-settings.md` (Billing + Plans). **Depends on:** `01` (Subscription),
`03` (User), `05` (account-limit enforcement).

## Scope
Stripe-backed subscriptions: 3 plans, monthly/annual, 7-day trial, 7-day refund, the $5 API
add-on (gate only; feature later), feature gating by plan. **All limits enforced server-side.**

## Plan catalog (`src/server/plans.ts`) — locked pricing
```ts
export const PLANS = {
  creator: { name:'Creator', monthly:29, yearly:319, accountLimit:15,
             tagline:'Best for growing creators',
             features:['Unlimited posts','Schedule & queue','Carousels','Bulk tools',
                       'Content studio','Analytics (beta)','API add-on available','Human support'] },
  growth:  { name:'Growth',  monthly:49, yearly:529, accountLimit:50,
             tagline:'Best for growing teams & agencies',
             features:['Everything in Creator','Viral content tools','Priority support'] },
  pro:     { name:'Pro',     monthly:99, yearly:1069, accountLimit:Infinity,
             tagline:'Best for scaling brands',
             features:['Everything in Growth','Unlimited connected accounts','Viral consulting',
                       'Invite team members (later)'] },
} as const;
// yearly ≈ "save ~2 months" vs monthly*12. Adjust to your real Stripe prices.
export function accountLimit(plan: PlanKey): number { return PLANS[plan].accountLimit; }
```
> Stripe Price IDs come from env (doc 00). `accountLimit` is the single source of truth used
> by `/connect/.../start` (doc 05) and the Plans/Billing UI.

## Pages (under `/settings`)
### Billing (`/settings/billing`)
- Annual-savings banner + "Upgrade to Annual" (`$348/yr → $319/yr` style).
- **Current Plan** card: plan name + price + **Trial** badge + "Trial ends {date}"; buttons
  **Change Plan / Pause / Cancel**.
- **API Access** card: "API Addon $5/mo", Active/Inactive badge, **Enable Addon**.
- Footer: **Stripe Billing Portal ↗**, **Request Refund**.

### Plans (`/settings/plans`)
- Monthly/Yearly toggle; 3 plan cards from `PLANS`; current plan marked; "Get started" /
  "Change plan" CTAs; "7-day money-back guarantee" note.

## Stripe integration
```
POST /api/billing/checkout { plan, interval }
   → create/lookup Stripe Customer (store stripeCustomerId)
   → Checkout Session (subscription mode, trial_period_days: 7, price from env)
   → return session URL → redirect

POST /api/billing/portal   → Billing Portal session URL (manage card, cancel, invoices)
POST /api/billing/addons/api { enable } → add/remove API addon subscription item
POST /api/billing/refund   → record refund request (see refund policy below)

POST /api/webhooks/stripe  (no auth; verify signature with STRIPE_WEBHOOK_SECRET)
```

### Webhook → Subscription sync (source of truth = Stripe)
Handle and upsert `Subscription`:
- `checkout.session.completed` / `customer.subscription.created|updated` → set plan,
  interval, status (`trialing|active|past_due|paused|canceled`), `trialEndsAt`,
  `currentPeriodEnd`, `stripeSubId`.
- `customer.subscription.deleted` → status `canceled`.
- `invoice.payment_failed` → `past_due`.
- Map Stripe Price ID → `PlanKey`/`interval` via env lookup.

## Trial & refund
- **Trial:** 7 days (`trial_period_days: 7`); `$0` due at checkout; cancel anytime in portal.
  New signups also get a local trialing Subscription (doc 03) before any Stripe checkout —
  reconcile when they subscribe.
- **Refund:** 7-day money-back. "Request Refund" → if within 7 days of last charge, either
  auto-refund via Stripe API or create a support ticket (MVP: record request +
  email support). Record policy in `DECISIONS.md`.

## Feature gating
- **Account limit** (primary gate): enforced in `/connect/:platform/start` (doc 05) and shown
  on Plans. `count(active accounts) < accountLimit(plan)`.
- **API add-on:** API keys page (doc 12/later) gated behind `subscription.apiAddonActive`.
- **Growth/Pro-only** features (viral tools, team invites) gated by plan — later phases.
- A `requirePlan(min)` / `assertAccountLimit(user)` helper in `src/server/plans.ts` used by
  handlers; never gate on the client alone.

## Edge cases
- Webhook out of order / retried → upsert idempotently keyed by `stripeSubId`.
- Downgrade below current account count (e.g. Pro→Creator with 20 accounts) → block new
  connects; existing accounts kept but flagged "over limit" (don't silently delete). Record
  decision.
- Trial expiry without payment → status moves per Stripe; restrict connecting/publishing as
  policy dictates (MVP: keep read-only + prompt to subscribe).
- Refund after 7 days → deny with message.

## Acceptance criteria
- Checkout creates a Stripe subscription with a 7-day trial and updates `Subscription` via
  webhook.
- Portal link opens Stripe customer portal; cancel reflects back as `canceled`.
- Account-limit gate blocks connects beyond the plan limit (tested via Stripe test mode).
- Plan/Billing pages render live subscription state (plan, trial end, interval).

## Verification
1. Stripe test mode: subscribe to Creator monthly → webhook sets `trialing`, `trialEndsAt`
   +7d; Billing page shows the trial badge.
2. Open portal, cancel → webhook → status `canceled`.
3. On Growth (limit 50) connect 3 accounts fine; set plan to a test low limit → next connect
   blocked.
4. Enable API addon → `apiAddonActive=true`; API keys page ungated (later).

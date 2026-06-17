# 10 — Billing & Plans

**Design refs:** `../11-settings.md` (Billing + Plans). **Depends on:** `01` (Subscription),
`03` (User), `05` (account-limit enforcement).

## Scope
PayPal-backed subscriptions: 3 plans, monthly/annual, 7-day trial, 7-day refund, the $5 API
add-on (gate only; feature later), feature gating by plan. **All limits enforced server-side.**

> **Provider:** PayPal Subscriptions API (was Stripe). A `BILLING_MODE` gate (`mock` | `live`)
> lets the whole flow run with no PayPal account in dev; live wiring lives in
> `src/server/paypal.ts`, the provider-agnostic config in `src/server/billing-config.ts`, and
> the shared service in `src/server/billing.ts`. DB columns are provider-neutral
> (`providerCustomerId`, `providerSubId`, `providerAddonSubId`, `RefundRequest.providerRefundId`).

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
// yearly ≈ "save ~2 months" vs monthly*12. Adjust to your real PayPal plan prices.
export function accountLimit(plan: PlanKey): number { return PLANS[plan].accountLimit; }
```
> PayPal billing-plan IDs come from env (`PAYPAL_PLAN_<TIER>_<INTERVAL>`, plus
> `PAYPAL_PLAN_API_ADDON`). The trial is configured **on the PayPal plan** (a TRIAL billing
> cycle), not at checkout. `accountLimit` is the single source of truth used by
> `/connect/.../start` (doc 05) and the Plans/Billing UI.

## Pages (under `/settings`)
### Billing (`/settings/billing`)
- Annual-savings banner + "Upgrade to Annual" (`$348/yr → $319/yr` style).
- **Current Plan** card: plan name + price + **Trial** badge + "Trial ends {date}"; buttons
  **Change Plan / Cancel subscription** (PayPal has no hosted billing portal, so cancel is a
  direct API action).
- **API Access** card: "API Addon $5/mo", Active/Inactive badge, **Enable Addon** (enabling
  redirects to a PayPal approval page for the standalone add-on subscription).
- Footer: **Request Refund**.

### Plans (`/settings/plans`)
- Monthly/Yearly toggle; 3 plan cards from `PLANS`; current plan marked; "Get started" /
  "Change plan" CTAs; "7-day money-back guarantee" note.

## PayPal integration
```
POST /api/billing/checkout { plan, interval }
   → create PayPal subscription (plan_id from env, custom_id = userId, trial on the plan)
   → return the `approve` HATEOAS link → redirect (no local row yet; the webhook is the truth)

POST /api/billing/cancel        → cancel the PayPal subscription (no portal); reflect canceled
POST /api/billing/addons/api { enable }
   → enable: create a standalone add-on PayPal subscription (custom_id = "userId:addon"),
     return its approve URL; webhook flips apiAddonActive once active
   → disable: cancel the add-on subscription, clear the flag
POST /api/billing/refund        → record refund request (see refund policy below)

POST /api/webhooks/paypal  (no auth; verify via PayPal verify-webhook-signature + PAYPAL_WEBHOOK_ID)
```

### Webhook → Subscription sync (source of truth = PayPal)
Resolve the user from `resource.custom_id` (the `:addon` suffix marks the add-on sub), then
upsert `Subscription`:
- `BILLING.SUBSCRIPTION.ACTIVATED` / `.UPDATED` → re-fetch the subscription and set plan,
  interval, status (`trialing|active|past_due|paused|canceled`), `trialEndsAt`,
  `currentPeriodEnd`, `providerSubId`. (Add-on events flip `apiAddonActive` instead.)
- `.CANCELLED` / `.EXPIRED` → status `canceled`.
- `.SUSPENDED` → `paused`.
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED` → `past_due`.
- `PAYMENT.SALE.COMPLETED` → refresh `currentPeriodEnd`.
- Map PayPal plan id → `PlanKey`/`interval` via env lookup; status via `mapPaypalStatus`.

## Trial & refund
- **Trial:** 7 days, configured as a TRIAL billing cycle on the PayPal plan; `$0` due at
  approval; cancel anytime. New signups also get a local trialing Subscription (doc 03) before
  any PayPal checkout — reconcile when they subscribe.
- **Refund:** 7-day money-back. "Request Refund" → if within 7 days of last charge, record a
  request for the admin queue + email support (MVP). Staff approval refunds the latest PayPal
  subscription transaction via `/v2/payments/captures/{id}/refund`. Record policy in `DECISIONS.md`.

## Feature gating
- **Account limit** (primary gate): enforced in `/connect/:platform/start` (doc 05) and shown
  on Plans. `count(active accounts) < accountLimit(plan)`.
- **API add-on:** API keys page (doc 12/later) gated behind `subscription.apiAddonActive`.
- **Growth/Pro-only** features (viral tools, team invites) gated by plan — later phases.
- A `requirePlan(min)` / `assertAccountLimit(user)` helper in `src/server/plans.ts` used by
  handlers; never gate on the client alone.

## Edge cases
- Webhook out of order / retried → upsert idempotently keyed by `userId` (from `custom_id`).
- Downgrade below current account count (e.g. Pro→Creator with 20 accounts) → block new
  connects; existing accounts kept but flagged "over limit" (don't silently delete). Record
  decision.
- Trial expiry without payment → status moves per PayPal; restrict connecting/publishing as
  policy dictates (MVP: keep read-only + prompt to subscribe).
- Refund after 7 days → deny with message.

## Acceptance criteria
- Checkout creates a PayPal subscription with a 7-day trial and updates `Subscription` via
  webhook.
- Cancel hits the PayPal API (no portal); status reflects back as `canceled`.
- Account-limit gate blocks connects beyond the plan limit (tested via PayPal sandbox).
- Plan/Billing pages render live subscription state (plan, trial end, interval).

## Verification
1. PayPal sandbox: subscribe to Creator monthly → approve with the sandbox buyer →
   `BILLING.SUBSCRIPTION.ACTIVATED` webhook sets `trialing`/`active`, `providerSubId`; Billing
   page shows the state.
2. Cancel → `.CANCELLED` webhook → status `canceled`.
3. On Growth (limit 50) connect 3 accounts fine; set plan to a test low limit → next connect
   blocked.
4. Enable API addon → approve the standalone add-on sub → webhook sets `apiAddonActive=true`.

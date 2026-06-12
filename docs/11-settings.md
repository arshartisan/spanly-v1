# 11 — Settings (General / Queue / Billing / Plans)

**Screenshots:**
- `app-settings-general.png` — Settings tab
- `app-settings-queue.png` — Queue tab
- `app-settings-billing.png` — Billing tab
- `app-settings-plans.png` — Plans tab

All four share a tab bar: **Settings · Queue · Billing · Plans**.

---

## A) General (`app-settings-general.png`)
Stacked cards:
- **Profile** — avatar, **Display Name** input + Save, email shown.
- **Email Address** — current email + **Change Email Address**.
- **Password** — **Change Password**; **Forgot Password? Send Reset Link**.
- **Security** — "Sign out of all devices…" + **Sign Out All Devices**.
- **Email Preferences** (toggles): **Automation Emails**, **Post Failure Alerts**, **Post Summary Emails**.
- **Platform Preferences** (toggles): **Use file name as caption**, **24-hour time format**, **Process videos on our servers** (ON/green — re-encodes uploads server-side).
- **Weekly Posting Goal** — number input "posts per week" + Save.
- **Connect to Claude (MCP)** — MCP URL field + **Copy** + **Setup Guide** (exposes the user's posting via an MCP endpoint).
- **Connected Apps** — OAuth apps with access (empty here).

```
UserSettings: { displayName, email, emailPrefs:{automation,failureAlerts,summary},
                platformPrefs:{filenameAsCaption,use24h,processVideosServerSide},
                weeklyPostingGoal, mcpUrl }
```
`GET/PATCH /settings`, `POST /settings/email/change`, `POST /settings/password/...`, `POST /settings/signout-all`.

---

## B) Queue (`app-settings-queue.png`)
- **Queue Schedule** — "You have 10 slots to post during your week. Editing your schedule here won't affect posts that are already scheduled." Timezone shown (`Asia/Colombo`).
- **Grid:** rows = times (`11:00 am`, `4:00 pm`), columns = `Mon…Sun` with check toggles (Mon–Fri checked in sample). Each time row has an `×` to remove.
- **Add time** row: time picker (`12:00 PM`) + **+ Add time**.
- **Randomize posting time** toggle — "Vary each post by up to 10 minutes…".

```
QueueSlot: { id, time:'HH:mm', days:[mon..sun bool], timezone }
QueueSettings: { slots:[QueueSlot], randomizeWithinMinutes:0|10 }
```
`GET/PUT /queue`. "Add to queue" (doc 01) fills the next open slot.

---

## C) Billing (`app-settings-billing.png`)
- Banner **"Save 2 Months with Annual Billing"** + **Upgrade to Annual** ( ~~$348/year~~ → **$319/year** ).
- **Current Plan** card: **Creator Plan** `$29.00/month`, **Trial** badge; "Trial ends June 19, 2026"; "Amount $29.00 after trial"; yellow notice "You're on a free trial!…"; buttons **Change Plan / Pause Subscription / Cancel Subscription**.
- **API Access** card: **API Addon** `$5/month · Programmatic posting`, **Inactive** badge, green **Enable Addon**.
- Footer buttons: **Stripe Billing Portal ↗**, **Request Refund**. "Access billing history, payment methods, and invoices."

```
Subscription: { plan:'creator'|'growth'|'pro', interval:'month'|'year', amount,
                status:'trial'|'active'|'paused'|'canceled', trialEndsAt,
                addons:{ api:{active,price} } }
```
Stripe-backed: `GET /billing`, `POST /billing/portal`, `POST /billing/refund`, `POST /billing/addons/api`.

---

## D) Plans (`app-settings-plans.png`)
- **Monthly / Yearly** toggle (Yearly shows a "save" badge).
- **3 plan cards:**
  - **Creator $29/mo** — "Best for growing creators"; *Your Current Plan*; ~15 connected accounts, multiple accounts/platform, unlimited posts, schedule, carousels, bulk, content studio, analytics (beta), API add-on available, human support.
  - **Growth $49/mo** — "Best for growing teams & agencies"; ~50 connected accounts; + viral content tools, priority support; green **Get started**.
  - **Pro $99/mo** — "Best for scaling brands"; **Unlimited** connected accounts; + viral consulting, invite team members; green **Get started**.
  - Cards note **7-day money-back guarantee**.

```
Plan: { key, name, monthly, yearly, tagline, accountLimit:number|'unlimited', features:[], current:bool }
```
`GET /plans`, `POST /billing/checkout` { plan, interval }.

## Notes for the clone
- Build one Settings page with 4 tab routes.
- Gate features (API keys, account limits, team invites) by `subscription.plan`.
- Queue slots power both the composer "Add to queue" and bulk distribution.

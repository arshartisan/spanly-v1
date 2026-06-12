# 11 — Settings (General / Queue / Billing / Plans)

**Design refs:** `../11-settings.md`. **Depends on:** `03` (auth/account), `08` (queue),
`10` (billing/plans).

## Scope
One settings page with four tab routes: `/settings/general`, `/settings/queue`,
`/settings/billing`, `/settings/plans`. Billing + Plans are specified in doc 10; this doc
covers **General** and **Queue** plus the shared tab shell.

## Tab shell
- `src/app/(app)/settings/[tab]/page.tsx` renders a tab bar (Settings · Queue · Billing ·
  Plans) + the active panel. `tab` ∈ `general|queue|billing|plans`.

## A) General (`/settings/general`)
Stacked cards backed by `User.settings` (JSON) + auth actions (doc 03):
- **Profile** — avatar upload, Display Name + Save.
- **Email Address** — current email + Change Email (re-verify).
- **Password** — Change Password (current + new); Forgot Password (send reset).
- **Security** — Sign Out All Devices (deletes sessions).
- **Email Preferences** (toggles): Automation Emails, Post Failure Alerts, Post Summary.
- **Platform Preferences** (toggles): Use file name as caption, 24-hour time format,
  Process videos on our servers (drives `media.process`, doc 06/08).
- **Weekly Posting Goal** — number input + Save (used on dashboard).
- **Connect to Claude (MCP)** — MCP URL field + Copy + Setup Guide (later phase; show
  placeholder/disabled in MVP).
- **Connected Apps** — OAuth apps with access (empty in MVP).

### Settings shape (`User.settings`)
```ts
{
  emailPrefs: { automation:boolean, failureAlerts:boolean, summary:boolean },
  platformPrefs: { filenameAsCaption:boolean, use24h:boolean, processVideosServerSide:boolean },
  weeklyPostingGoal: number,
  mcpUrl?: string
}
```
API: `GET /api/settings`, `PATCH /api/settings` (partial), plus auth endpoints (doc 03).

## B) Queue (`/settings/queue`)
Backed by `QueueSettings` + `QueueSlot` (doc 01); powers "Add to queue" (doc 08).
- Header: "You have N slots to post during your week. Editing here won't affect already
  scheduled posts." Timezone shown.
- **Grid:** rows = times (e.g. 11:00 am, 4:00 pm), columns = Mon…Sun checkboxes; each row has
  a remove `×`.
- **Add time:** time picker + "+ Add time".
- **Randomize posting time** toggle ("vary each post by up to 10 minutes").
- Timezone selector (defaults to user timezone).

API: `GET /api/queue`, `PUT /api/queue` (replace slots + settings atomically).

## C/D) Billing & Plans
See **doc 10**. The tab shell just mounts those panels.

## Edge cases
- Save with no changes → no-op, success toast.
- Removing all queue slots → "Add to queue" should warn there are no slots (composer doc 06).
- Changing timezone in Queue vs User timezone — keep them consistent; document which wins
  (Queue timezone is authoritative for slot computation).
- Avatar upload uses the same presign path as media (doc 06) but a separate `avatars/` prefix.

## Acceptance criteria
- All four tabs route correctly and render their panels.
- General toggles persist to `User.settings` and survive reload.
- Queue grid edits persist; adding/removing slots updates `QueueSlot` rows.
- "Process videos on our servers" toggle actually gates the `media.process` job.

## Verification
1. Toggle "24-hour time format" → reload → still on; time displays switch format.
2. Add a 9:00 am Mon–Fri slot, remove the 4:00 pm slot → `PUT /api/queue` persists; composer
   "Add to queue" uses the new slots.
3. Turn off "Process videos on our servers" → uploading a video skips the process job
   (`Media.processed` stays false, raw file used).

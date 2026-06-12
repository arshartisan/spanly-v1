# 04 — App Shell & Navigation

**Design refs:** `../00-app-shell-and-navigation.md`. **Depends on:** `03` (session).

## Scope
The persistent authenticated layout wrapping every `/(app)/*` page: left sidebar, "Create
post" CTA, account menu. Single-workspace MVP (workspace switcher is rendered but shows one
default workspace; full multi-workspace deferred).

## Layout
`src/app/(app)/layout.tsx` — server component; loads current user + subscription + account
count, renders `<Sidebar/>` + `<main>{children}</main>`.

### Sidebar (~230px, white, fixed, scrollable)
```
[ Spanly logo ]
[ Workspace switcher ▾ ]        (single "Personal" workspace in MVP)
[ + Create post ]  (green CTA → /create/text)
──────────────────────────────
CREATE
  • Create post            /create/text
  • Content Studio  (Later, hidden or "soon")
POSTS
  • All Posts              /posts/all
  • Scheduled              /posts/scheduled
  • Posted                 /posts/posted
  • Drafts                 /posts/drafts
  • Calendar               /calendar
WORKSPACE
  • Connections            /connections
  • Queue                  /settings/queue
CONFIGURATION
  • Settings               /settings/general
  • Billing                /settings/billing
  • Plans                  /settings/plans
SUPPORT
  • Help  (external/later)
──────────────────────────────
[ avatar | displayName | plan label ▾ ]   → account menu
```
- Active link highlighted green (matches design system: primary `#16a34a`-ish green, light
  gray surfaces). Exact tokens defined in a `tailwind` theme + `globals.css`.
- **Account menu dropdown:** Settings, Billing, Sign out.
- **Plan label** under the name reads from `subscription.plan` (e.g. "Creator — Trial").

## Route map (authenticated)
| Path | Doc |
|---|---|
| `/dashboard` | landing (empty-state → connect first account) |
| `/create/[type]` | composer — type ∈ text/image/video/story (`06`) |
| `/posts/[filter]` | filter ∈ all/scheduled/posted/drafts (`07`) |
| `/calendar` | calendar (`07`) |
| `/connections` | connections (`05`) |
| `/publishing/[postId]` | publish progress (`09`) |
| `/settings/[tab]` | tab ∈ general/queue/billing/plans (`11`) |

## Components
- `components/shell/Sidebar.tsx` (client for active-state + dropdowns).
- `components/shell/AccountMenu.tsx`.
- `components/shell/CreatePostButton.tsx`.
- `components/shell/WorkspaceSwitcher.tsx` (static single workspace now).
- Shared `components/ui/*` from shadcn (button, dropdown-menu, avatar, dialog, etc.).

## Empty / first-run state (dashboard)
If the user has **0 connected accounts**, the dashboard shows a prominent "Connect your first
account" card linking to `/connections` (doc 05). Otherwise show quick stats + recent posts.

## Acceptance criteria
- Every authenticated page renders inside the shell; sidebar persists across navigation.
- Active route is visually highlighted; navigation is client-side (no full reloads).
- Account menu shows correct plan label and signs out.
- New user with no accounts sees the connect-first empty state.

## Verification
1. Log in → sidebar visible on every `/(app)` route.
2. Click each nav item → correct page loads, active state updates.
3. Seeded demo user (has accounts) → dashboard shows stats, not the empty state.

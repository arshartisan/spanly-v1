# 00 — App Shell & Navigation

**Screenshots:** present in every `app-*.png` (e.g. `app-create-text-post.png`, `app-calendar.png`).

## Purpose
The persistent left sidebar + chrome that wraps every authenticated dashboard page. Build this once as a layout; all other screens render in the main content area to its right.

## Layout
- **Fixed left sidebar** (~230px), full height, white, thin right border. Vertically scrollable when content overflows.
- **Main content area** fills the rest; light gray background; pages scroll independently.
- **Floating support bubble** fixed at bottom-right on every page (Intercom-style chat launcher).

## Sidebar contents (top → bottom)
1. **Brand:** circular post-bridge logo + wordmark "post bridge".
2. **Workspace switcher:** small "Workspace" label, then a dropdown showing current workspace (`Main`) with a home icon + chevron. Opens workspace list / links to Manage Workspaces.
3. **Primary CTA:** full-width green **"Create post"** button with a `+` document icon.
4. **Section: Create** (collapsible, caret) — `New post`, `Studio`, `Bulk tools`.
5. **Section: Posts** — `Calendar`, `All`, `Scheduled`, `Posted`, `Drafts`, `Analytics` (Analytics has a small beaker/beta icon).
6. **Section: Workspace** — `Connections`, `Teams`.
7. **Section: Configuration** — `Settings`, `API Keys`, `Billing`.
8. **Section: Support** — `Share feedback`, `Earn 30% referral`, `Stay updated` (X icon), `Growth guide`, `Docs`.
9. **Account menu (pinned bottom):** user avatar + display name (`Abdul Muhaimin`) + plan label (`Creator Plan`) + up/down chevron → opens account/plan menu.

## UI states & behavior
- **Active item:** highlighted with green text + light pill background (e.g. `Calendar` active on the calendar page).
- Section headers have a caret to collapse/expand their group.
- Sidebar collapses to a narrower form on smaller widths (several screenshots show a condensed sidebar).
- `Billing`, `API Keys` here mirror the tabs inside Settings — they deep-link to the same screens.

## Suggested data model / API
```
Session/User: { id, displayName, avatarUrl, email, planName, planTier }
Workspace:    { id, name, isDefault, iconKey, accountCount }
NavBadge:     { analyticsBeta: bool }
```
- `GET /me` → user + current workspace + plan.
- `GET /workspaces` → list for the switcher.
- Nav is static config; only the workspace switcher and account menu are data-driven.

## Notes for the clone
- Treat the sidebar as a layout component with route-aware active state.
- The "Create post" button routes to the create-post composer (doc 01).
- Plan label drives gating shown elsewhere (API access, account limits).

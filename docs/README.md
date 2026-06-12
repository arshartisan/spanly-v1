# Post-Bridge Clone — Page Reference

This folder documents every screen captured in the reference screenshots (`../*.png`), to be used as a build spec for cloning the **post-bridge** social-media scheduling app.

Post-Bridge is a multi-platform social media scheduler: connect accounts (Instagram, LinkedIn, TikTok, X/Twitter, YouTube, Facebook, Bluesky, Threads, Pinterest, Google Business), compose one post, customize per platform, and publish now / schedule / queue it. It also has a calendar, analytics, content templates (Studio), bulk tools, workspaces, teams, billing, and an API.

## How to read this

- Each `.md` describes one screen (or a tightly related group): **purpose**, **layout**, **components**, **UI states**, **interactions**, and a **suggested data model / API** (framework-agnostic).
- Screenshot filenames are referenced inline. All images live one level up in `../`.
- OAuth consent screens are **provider-hosted** (see `14-oauth-connect-flows.md`) — you do not build them; you only build the "Connect" buttons + OAuth callback handling.

## Naming convention used for screenshots

| Prefix | Meaning |
|--------|---------|
| `app-*` | Pages inside the authenticated dashboard (these are the screens you build) |
| `support-*` | Public help-center / docs pages (optional to clone) |
| `oauth-*` | Third-party OAuth consent screens (reference only — not built by you) |

## Index

| Doc | Screens covered |
|-----|-----------------|
| [00-app-shell-and-navigation.md](00-app-shell-and-navigation.md) | Global sidebar, nav sections, workspace switcher, account menu (shared chrome) |
| [01-create-post.md](01-create-post.md) | Create text / image / video / story post + scheduler panel |
| [02-edit-post.md](02-edit-post.md) | Edit an existing post (update/duplicate/delete) |
| [03-publishing-flow.md](03-publishing-flow.md) | "Publishing post…" progress + per-platform result screen |
| [04-calendar.md](04-calendar.md) | Month/week content calendar |
| [05-content-studio.md](05-content-studio.md) | AI / template-driven content creation |
| [06-bulk-tools.md](06-bulk-tools.md) | Bulk video/image upload + bulk video creation |
| [07-posts-lists.md](07-posts-lists.md) | All / Scheduled / Posted / Drafts list views + filters |
| [08-analytics.md](08-analytics.md) | Analytics overview (empty/sync state) |
| [09-connections.md](09-connections.md) | Connected accounts + connect-method modal |
| [10-workspaces.md](10-workspaces.md) | Manage workspaces + create modal (and Teams) |
| [11-settings.md](11-settings.md) | Settings: General / Queue / Billing / Plans |
| [12-api-keys.md](12-api-keys.md) | API keys + webhook |
| [13-help-center.md](13-help-center.md) | Support help center home + article pages |
| [14-oauth-connect-flows.md](14-oauth-connect-flows.md) | X, LinkedIn, Instagram, Facebook, Google/YouTube, TikTok consent (reference) |

## Global design language (applies everywhere)

- **Primary color:** green (~`#22c55e`/emerald) — used for the "Create post" button, active nav, primary CTAs, "posted" status, success badges.
- **Surface:** light gray app background (`~#f3f4f6`), white cards with subtle borders and rounded corners (`~rounded-lg`), soft shadows.
- **Status colors:** posted = green, scheduled = blue/cyan, draft = amber/yellow, trial/inactive = neutral pill.
- **Typography:** clean sans-serif; large bold page titles; muted gray helper/subtitle text.
- **Dark buttons:** secondary actions on connections/billing use dark (`~slate-900`) filled buttons.
- **Persistent UI:** left sidebar (see doc 00) on every `app-*` screen; floating chat/support bubble bottom-right.
- **Suggested stack (your choice):** any SPA/SSR framework + a utility CSS system. Data model fields below are framework-agnostic.

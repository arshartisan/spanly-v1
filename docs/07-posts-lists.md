# 07 — Posts Lists (All / Scheduled / Posted / Drafts)

**Screenshots:**
- `app-posts-all.png` — "All Posts"
- `app-posts-scheduled.png` — "Scheduled Posts"
- `app-posts-posted.png` — "Successfully Posted"
- `app-posts-drafts.png` — "Draft Posts"

## Purpose
Four filtered views of the same post collection, differing only by status filter and title. One reusable list component.

## Layout (shared)
- **Title** per view: `All Posts` / `Scheduled Posts` / `Successfully Posted` / `Draft Posts` (+ info icon). Top-right **refresh** icon.
- **Filter bar:** funnel icon + dropdowns: **Newest First** (sort), **All Platforms**, **All Time**, **All Posts** (type), **All Accounts**.
- **Post cards** (vertical list): top row = date (`6/12/2026`) + time (`1:31 PM`); a type chip (`text`); the caption text; footer row = account avatars (per targeted platform) + a **status badge**.
- **Status badge colors:** `posted` = green, `scheduled` = blue/cyan, `draft` = amber/yellow.
- **Drafts-only notice:** *"Draft posts older than 90 days are automatically deleted to keep your workspace organized."*
- Empty state when no posts match filters.

## Interactions
- Click a card → open editor (doc 02) / detail.
- Sort + 4 filter dropdowns (platform / time range / post type / account).
- Refresh re-fetches.

## Suggested data model / API
```
PostListQuery: { workspaceId, status?:'scheduled'|'posted'|'draft',
                 sort:'newest'|'oldest', platform?, dateRange?, type?, accountId? }
PostCard: { id, type, caption, scheduledOrPostedAt, status, accounts:[{platform,avatarUrl}] }
```
- `GET /posts?status=scheduled&sort=newest&platform=&...`
- The four routes are the same endpoint with a fixed `status` (All = no status filter).

## Notes for the clone
- Build one `PostList` component; pass `status` + title via route config.
- Status badge + filter values come straight from the post model.

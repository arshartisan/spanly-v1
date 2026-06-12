# 04 — Content Calendar

**Screenshot:** `app-calendar.png`

## Purpose
A month/week calendar visualizing scheduled and posted content across all platforms. Primary planning surface.

## Layout
- Page title **"Calendar"** + info icon.
- **Top-right controls:**
  - Month navigation: `‹ June 2026 ›` (prev/next).
  - **All Platforms** dropdown (filter by platform).
  - **Month** / **Week** toggle (Month active = green).
- **Month grid:** 7 columns `Sun … Sat`, weeks as rows. Each cell shows the date label; empty cells show muted **"No posts"**. **Today** (Jun 12) is highlighted with a green date header / cell tint.

## UI states
- Empty state: every cell "No posts".
- Populated: cells contain post chips (platform icon + time + caption snippet, color-coded by status) — clicking opens/edit the post.
- Week view: hour-by-hour or day-column layout for the selected week.
- Platform filter narrows which posts render.

## Interactions
- Click a day / empty cell → start a new post scheduled for that day.
- Click a post chip → open editor (doc 02).
- Prev/next month, switch Month/Week, change platform filter.

## Suggested data model / API
```
CalendarQuery: { workspaceId, view:'month'|'week', anchorDate, platform? }
CalendarItem:  { postId, platform, status, publishAt, captionSnippet, accountAvatarUrl }
```
- `GET /calendar?from=&to=&platform=` → items grouped by day.

## Notes for the clone
- Drive the grid off a date range; bucket items by `publishAt` day.
- Drag-to-reschedule is a natural enhancement (update `publishAt`).

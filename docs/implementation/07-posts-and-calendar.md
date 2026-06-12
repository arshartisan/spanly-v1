# 07 — Posts Lists & Calendar

**Design refs:** `../07-posts-lists.md`, `../04-calendar.md`.
**Depends on:** `01` (Post/PostTarget), `06` (composer for edit).

## Part A — Posts lists (`/posts/[filter]`)
One list component, four filters via the route param: `all | scheduled | posted | drafts`.

### Query mapping
| filter | where |
|---|---|
| all | all posts for user |
| scheduled | `status = scheduled` |
| posted | `status = posted` |
| drafts | `status = draft` |

### UI
- Title per view + refresh icon.
- **Filter bar:** sort (Newest First default), platform filter ("All Platforms"), time range,
  post type, account.
- **Post cards:** date + time, type chip, caption snippet, target account avatars, **status
  badge** — green = posted, blue = scheduled, amber = draft, red = failed.
- Click a card → edit (draft/scheduled) or detail (posted) via composer (doc 06).
- Pagination or infinite scroll (cursor on `createdAt`).

### Drafts auto-cleanup
- Drafts older than **90 days** are auto-deleted (design doc 07). Implement as a daily
  cron/worker job: delete `status=draft AND createdAt < now-90d`. Log counts.

### API
```
GET /api/posts?status=&platform=&type=&account=&range=&sort=&cursor=
```
Returns posts with their targets (account avatar/handle + per-target status) for badges.

## Part B — Calendar (`/calendar`)
Month and week views of scheduled/posted content.

### Month view
- 7 columns (Sun–Sat), weeks as rows. Each day cell: date number + **post chips**
  (platform icon, time, caption snippet), color-coded by status.
- Controls: prev/next month, "All Platforms" filter, **Month / Week** toggle.
- Click empty day → `/create/text?date=YYYY-MM-DD` (prefill schedule date).
- Click a chip → edit that post (doc 06).

### Week view
- Hour-by-hour grid for the selected week; chips placed at their `publishAt` local time.

### Data
```
GET /api/posts/calendar?from=&to=&platform=
```
- Returns posts whose `publishAt` (or `publishedAt`) falls in `[from,to]`, expanded to
  per-target chips (a post to 3 accounts = 3 chips, or 1 chip with 3 icons — choose 1 chip
  with stacked icons for density; document choice).
- All times converted to the **user's timezone** for placement.

## Edge cases
- Posts with no `publishAt` (drafts/now) don't appear on the calendar.
- DST boundaries: compute day buckets in user tz, store UTC.
- A failed post shows red on both list and calendar; clicking offers retry (doc 09).
- Empty states per view ("No scheduled posts yet — create one").

## Acceptance criteria
- Each filter shows only the matching posts with correct status badges.
- Filter bar narrows results (platform/type/account/range) and sort works.
- Calendar month view places chips on the correct local-time day; toggling to week view keeps
  the same data.
- Clicking a day opens the composer with the date prefilled; clicking a chip edits the post.
- Drafts older than 90 days are removed by the cleanup job.

## Verification
1. Seeded user: schedule 3 posts across this month → appear under Scheduled and on the
   calendar on correct days.
2. Change user timezone → chip day/time placement shifts accordingly.
3. Force a failed target → red badge in list + red chip in calendar.
4. Insert a 100-day-old draft, run cleanup job → it's deleted.

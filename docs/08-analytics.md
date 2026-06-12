# 08 — Analytics

**Screenshot:** `app-analytics.png` (empty / syncing state)

## Purpose
Performance analytics for posts published through Post-Bridge. Marked beta in the sidebar.

## Layout
- Page title **"Analytics"**.
- **Tabs:** `Overview` / `Posts`.
- **Empty state (captured):** bar-chart icon, heading **"No analytics data yet"**, subtext "Sync your data to see how your posts are performing. Analytics are available for posts made through Post Bridge.", status line "Syncing — first sync can take up to 2 minutes." + a disabled **Syncing…** button.

## Populated state (build it; not screenshotted)
- **Overview tab:** KPI cards (impressions, engagement, followers, reach) + time-series charts + per-platform breakdown, with a date-range selector.
- **Posts tab:** table of posts with per-post metrics (likes, comments, shares, views), sortable.

## Interactions
- Tab switch Overview/Posts.
- Manual **Sync** to pull fresh metrics from platforms; first sync ≤ 2 min.
- Date range + platform filters (in populated state).

## Suggested data model / API
```
AnalyticsSync: { workspaceId, status:'idle'|'syncing'|'ready', lastSyncedAt }
OverviewMetrics: { range, totals:{impressions,engagement,reach,followers}, series:[...], byPlatform:[...] }
PostMetric: { postId, platform, likes, comments, shares, views, engagementRate, publishedAt }
```
- `POST /analytics/sync` → kicks sync; `GET /analytics/overview?range=`; `GET /analytics/posts`.
- Only posts made through the app have metrics (store provider post IDs at publish time).

## Notes for the clone
- Ship the empty + syncing states first; they're required and shown by default for new accounts.
- Metrics depend on each platform's insights API — gate behind connected-account scopes.

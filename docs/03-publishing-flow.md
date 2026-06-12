# 03 — Publishing Flow

**Screenshots:**
- `app-publishing-post-progress.png` — "Publishing post…" in-progress state
- `app-post-published-result.png` — per-platform result screen

## Purpose
The transient screens shown immediately after "Post now": a progress state while the post is pushed to each platform, then a result screen with per-platform success/failure and links to the live posts.

## A) Publishing progress (`app-publishing-post-progress.png`)
- Centered column on the content area.
- Circular upload/spinner icon (green ring).
- Heading **"Publishing post…"**, subtext "Publishing your post to all the places".
- Info box: *"Posts can take up to 10 minutes to show on all platforms."*
- Green **Check Status** button.
- Muted "Auto-refreshing to check status".
- Link **"Create another post while you wait →"**.

**Behavior:** polls/auto-refreshes the post's per-target status until all resolve.

## B) Result screen (`app-post-published-result.png`)
- Top full-width banner: paper-plane icon + **"Your content was posted to the following platforms"**; top-right **"+ Create a new post"** button.
- **Per-platform result cards** (grid): platform icon + name + account handle (e.g. `twitter @DevMuhaimin2001`, `linkedin @Abdul Muhaimin`), green **Success** badge, and a green **View post ↗** button (opens the live post).
- **More post info** section: a card "Post caption" (green status dot) showing the published caption text.

**Failure variant (build it):** a red "Failed" badge + error reason + Retry button per card (not screenshotted but required for parity).

## Suggested data model / API
```
PublishResult: {
  postId,
  targets: [{ socialAccountId, platform, handle, status:'pending'|'success'|'failed',
              externalPostUrl?, error? }],
  caption
}
```
- `POST /posts/:id/publish` → returns job; `GET /posts/:id/status` polled until terminal.
- Map each target to a card; show View/Retry per `status`.

## Notes for the clone
- Model publishing as async per-target jobs; the UI is a poller over those statuses.
- Persist `externalPostUrl` so "View post" works after navigation.

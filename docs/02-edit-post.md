# 02 — Edit Post

**Screenshot:** `app-edit-text-post.png`

## Purpose
Editing an existing (scheduled/draft) post. Same composer as doc 01, but in edit mode with different primary actions. Reached by opening a post from a list/calendar.

## Layout
Identical to the create composer:
- Title becomes **"Edit your text post"** (matches the post type).
- Account row pre-selected to the post's existing targets.
- **Main Caption** pre-filled (example: "This is a scheduled post", counter `24/3000`).
- `Platform Captions` / `Past Captions` tools present.
- Right **Schedule card** pre-filled with the saved date/time (example: `Jun 12, 2026`, `2:00 PM`) and Quick-set chips; helper "Your post will be posted at 2:00 PM in your local time."

## Primary actions (right panel)
- Green **Update** — save changes.
- **Duplicate** — clone this post into a new draft.
- **Delete** — remove the post.
- **Create another Text post** — start a fresh composer of the same type.

## UI states
- Caption limit here observed as **3000** (vs 2200 on the text create screen) — limits are platform/context dependent; store the effective limit on the post.
- Edit is disabled / restricted once a post has already been published (you'd edit only draft/scheduled).

## Suggested data model / API
- `GET /posts/:id` → hydrate composer.
- `PATCH /posts/:id` → Update.
- `POST /posts/:id/duplicate` → returns new draft id.
- `DELETE /posts/:id` → Delete (confirm dialog recommended).

## Notes for the clone
- Reuse the composer component; switch the action bar (Update/Duplicate/Delete) based on `mode === 'edit'`.
- Keep an `effectiveCaptionLimit` on the post so the counter is consistent between create and edit.

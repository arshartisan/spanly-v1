# 01 — Create Post (Composer)

**Screenshots:**
- `app-create-text-post.png` — text composer, "Post now" mode
- `app-create-text-post-schedule-expanded.png` — scheduler panel expanded
- `app-create-image-post.png` — image composer with upload dropzone
- `app-create-video-post.png` — video composer (adds Processing tools)
- `app-create-story-post.png` — story composer (single media, no caption tools)

## Purpose
The core composer. One screen where the user picks accounts, writes a caption (optionally per-platform), attaches media, and chooses to post now / schedule / queue / save draft. The post **type** (text/image/video/story) changes which accounts are eligible, the upload affordance, and available tools — but the layout is shared.

## Layout (3 zones)
1. **Top toolbar:** page title (`Create text post` / `…image post` / `…video post` / `…story post`); left `Search & Filter` dropdown; right `Remember` toggle (remembers selected accounts/settings for next time).
2. **Account selector row:** horizontal row of circular platform-account avatars. Click to toggle which connected accounts this post targets. **Eligible accounts depend on type:**
   - Text → text-capable accounts (e.g. LinkedIn, X/Twitter).
   - Image → Instagram, LinkedIn, TikTok, X/Twitter.
   - Video → above + YouTube.
   - Story → Instagram only.
3. **Composer body:**
   - **(image/video/story only) Upload dropzone** — dashed box: "Click to upload or drag and drop / or hover and paste from clipboard", accepted-types helper ("Image(s) or PDF" / "Video" / "Image(s) or PDF or Video"), and a green **Import** button (import from URL/library). Story helper: *"Stories don't support captions, carousels, or cover images. Pick exactly one image or video."*
   - **Main Caption** — label + info icon, large textarea, placeholder "Start writing your post here…", character counter bottom-right with a circular progress ring. Limit observed: **2200** on create-text (per-platform limits apply elsewhere).
   - **Post configurations & tools** — pill buttons: `Platform Captions` (dropdown) and `Past Captions` (dropdown). Video also shows `Processing` (dropdown). Expanding **Platform Captions** reveals helper: *"When you select 2 or more accounts, you can customize the caption that gets used for each of them."*
4. **Right panel — Schedule card** (see states below).

## Schedule card states
- **Post-now mode (toggle OFF):** "Schedule post" header + toggle; large disabled **Post now** button; helper "Select an account to post to"; secondary **Save to Drafts** button.
- **Schedule mode (toggle ON):** tabs **Pick a time** / **Add to queue**; **Select date** (calendar) + time field (`12:00 PM`) + info icon; **Quick set** chips (`11:00 AM`, `3:00 PM`, `7:00 PM`); helper "Your post will be posted at HH:MM in your local time."; green **Schedule** button; **Save to Drafts**.
- **Add to queue tab:** drops the post into the next open queue slot (slots configured in Settings → Queue, doc 11).
- Buttons stay disabled until ≥1 account selected AND (caption or media) present.

## Interactions
- Toggling accounts updates per-platform caption tabs and validation (e.g. char limits, media requirements per platform).
- `Platform Captions` → expands editable caption-per-account when 2+ accounts selected; otherwise Main Caption is used for all.
- `Past Captions` → insert a previously used caption.
- `Processing` (video) → options like trimming/format handling; ties to Settings "Process videos on our servers".
- `Remember` → persists account selection + settings for the next composer session.

## Suggested data model / API
```
Post: {
  id, workspaceId, type: 'text'|'image'|'video'|'story',
  mainCaption, captionLimit,
  perPlatformCaptions: { [socialAccountId]: string },
  media: [{ id, kind:'image'|'video'|'pdf', url, order }],
  targets: [socialAccountId],
  schedule: { mode:'now'|'time'|'queue', publishAt?, timezone },
  status: 'draft'|'scheduled'|'publishing'|'posted'|'failed'
}
SocialAccount: { id, platform, handle, avatarUrl, capabilities:['text','image','video','story'] }
```
- `GET /accounts?capability=video` → eligible avatars for the row.
- `POST /posts` (draft), `POST /posts/:id/publish`, `POST /posts/:id/schedule`, `POST /posts/:id/queue`.
- `GET /captions/recent` → Past Captions.
- Validate per platform: caption length, media count (story = exactly 1), aspect/format.

## Notes for the clone
- Build one composer component parameterized by `type`; gate the dropzone and tools by type.
- Per-platform caption editing is the trickiest piece — model captions as a map keyed by account.
- Char counter limit should be the **minimum** limit across selected platforms (or per-tab when using platform captions).

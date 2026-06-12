# 06 — Composer (Create / Edit Post)

**Design refs:** `../01-create-post.md`, `../02-edit-post.md`.
**Depends on:** `01` (Post/PostTarget/Media), `02` (provider validate/limits), `05` (accounts),
`08` (queue slots), `09` (publish).

## Scope
One composer component parameterized by **type** (`text|image|video|story`) that powers both
create (`/create/[type]`) and edit (`/posts` → edit). It selects target accounts, writes a
main caption (+ per-platform overrides), attaches media, and chooses how to publish.

## Layout (3 zones — mirror design doc 01)
1. **Top toolbar:** title ("Create {type} post"); left "Search & Filter"; right "Remember"
   toggle (persists account selection + settings to `localStorage`/user settings).
2. **Account selector row:** circular avatars of connected accounts **eligible for the
   type** (filtered by `capabilities`):
   - text → text-capable (X, LinkedIn, Facebook)
   - image → X, LinkedIn, Facebook, Instagram, TikTok
   - video → above + YouTube
   - story → Instagram only
   Click to toggle membership in `targets`.
3. **Composer body:**
   - **Upload dropzone** (image/video/story only): click/drag/paste; "Import" from URL.
     Accepted types per type; **story = exactly one media, no caption tools**.
   - **Main Caption** textarea + character counter with circular ring. Counter limit =
     **min(captionMax)** across selected accounts (from provider limits, doc 02).
   - **Tools:** `Platform Captions` (per-account override editor, shown when ≥2 accounts),
     `Past Captions` (insert recent), and for video `Processing`.
4. **Right panel — Schedule card** (states below).

## Schedule card states
- **Post now (toggle OFF):** "Post now" button (disabled until valid) + "Save to Drafts".
- **Schedule (toggle ON):** tabs **Pick a time** / **Add to queue**.
  - *Pick a time:* date picker + time + Quick-set chips (11:00, 15:00, 19:00); helper "posted
    at HH:MM in your local time"; **Schedule** button.
  - *Add to queue:* drops into the **next open queue slot** (computed from `QueueSettings`,
    doc 08/11B).
- Buttons disabled until **≥1 account selected AND (caption OR media present)** AND all
  selected accounts pass `provider.validate`.

## Per-platform captions model
- `Post.perPlatform` = `{ [socialAccountId]: captionOverride }`.
- When publishing, the **resolved caption** for each target = `perPlatform[accountId] ??
  mainCaption`, stored on `PostTarget.caption` at schedule/publish time.
- The caption counter shows per-tab limits when editing platform captions.

## Media upload (doc 00 storage)
```
POST /api/media/presign  { filename, mimeType, sizeBytes } → { uploadUrl, mediaId, publicUrl }
  → client PUTs file directly to S3/R2
POST /api/media/finalize { mediaId, width, height, durationSec } → Media row (processed=false)
```
- Validate type/size against the **min** of selected platforms' limits.
- If user setting `processVideosServerSide` is ON, enqueue a `media.process` job (ffmpeg
  worker) to normalize; mark `processed=true` when done (doc 08).
- Thumbnails generated for video (first frame).

## Submit actions → API (doc 12)
```
POST /api/posts                 (create draft)        → Post(status=draft)
PATCH /api/posts/:id            (update)              → updates fields
POST /api/posts/:id/publish     (post now)            → status=publishing, enqueue immediate jobs
POST /api/posts/:id/schedule    { publishAt, tz }     → status=scheduled, enqueue delayed jobs
POST /api/posts/:id/queue       (add to queue)        → compute next slot → schedule
POST /api/posts/:id/duplicate   (edit screen)         → new draft copy
DELETE /api/posts/:id
```
On `publish`/`schedule`/`queue`, the server creates one **PostTarget per selected account**
with a unique `idempotencyKey` and the resolved caption.

## Edit post (doc 02)
- Same component, pre-filled from the Post. Caption limit context per design = 3000 (but
  effective limit is still min across platforms).
- Actions: **Update** (green), **Duplicate**, **Delete**, "Create another {type} post".
- Editing a `scheduled` post reschedules jobs; editing a `posted` post is read-only/duplicate.

## Validation (`src/lib/schemas/post.ts` + provider.validate)
- Type-specific: story requires exactly 1 media; image/video require ≥1 media; text requires
  caption.
- Per account: caption length ≤ that platform's `captionMax`; media count ≤ `mediaMax`;
  video duration/bytes within limits; aspect ratio allowed.
- Surface per-account validation errors inline on the account avatar / platform caption tab.

## Acceptance criteria
- One component renders all four types with the correct eligible-accounts set and tools.
- Counter reflects the strictest selected platform; over-limit blocks submit for that account.
- Per-platform caption overrides persist and are used per target at publish time.
- "Post now" creates publishing targets immediately; "Schedule" creates delayed jobs; "Add to
  queue" lands in the next open slot.
- Media uploads via presigned URL and attaches in order; story enforces exactly one.

## Verification
1. Create a text post to X + LinkedIn; type 300 chars → X tab shows over-limit (280), submit
   blocked until trimmed or X deselected.
2. Add a platform caption override for LinkedIn → verify the `PostTarget.caption` differs per
   account after scheduling (Prisma Studio).
3. Create an image post, upload 2 images → both attach with order 0,1.
4. Story type → only Instagram selectable, exactly one media enforced.
5. "Add to queue" with two Mon–Fri slots → publishAt equals the next future slot.

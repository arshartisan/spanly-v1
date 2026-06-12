# 06 — Bulk Tools

**Screenshot:** `app-bulk-tools.png`

## Purpose
Batch workflows for uploading/scheduling many posts at once, and bulk AI video creation. For power users / agencies.

## Layout
- Page title **"Bulk tools"**.
- **3 large dashed cards** in a row, each with an icon, title (+ `NEW` badge), description, and a row of supported-platform icons:
  1. **Bulk Video Upload** (`NEW`) — "Upload and schedule multiple videos at once." (Facebook, Instagram, LinkedIn, Pinterest, TikTok, X, Threads, YouTube icons.)
  2. **Bulk Image Upload** (`NEW`) — "Upload and schedule multiple images at once."
  3. **Bulk Video Creation** (`NEW`) — "Create viral 2×2 grid videos in bulk (AI assisted)."

## Interactions
- Click a card → its bulk flow: multi-file upload, then a table/grid to assign caption + accounts + schedule slot per item, then bulk submit (typically into the queue).

## Suggested data model / API
```
BulkJob: { id, kind:'video-upload'|'image-upload'|'video-creation', workspaceId,
           items:[{ mediaId, caption, targets:[accountId], publishAt|queue }],
           status }
```
- `POST /bulk/uploads` (multipart) → media list.
- `POST /bulk/jobs` → creates many posts (often auto-distributed across queue slots).

## Notes for the clone
- Reuse the composer's validation per item.
- Default scheduling = spread items across configured queue slots (doc 11).
- Supported-platform icon rows are static config per tool.

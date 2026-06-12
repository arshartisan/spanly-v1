# 05 — Content Studio

**Screenshot:** `app-content-studio.png`

## Purpose
A gallery of AI / template-driven content creators that jump-start viral-format videos. Entry point for templated content, distinct from the blank composer.

## Layout
- Page title **"Content Studio"**.
- **Featured banner card** (highlighted border): badges `NEW` + `AI-Powered`; title "✨ AI UGC Video Creator"; description ("Create authentic UGC-style videos in seconds using our AI-powered templates. Perfect for product demos, testimonials, and viral marketing content."); stat chips `SUPER HOT`, `Infinite views`; green CTA **"Try AI UGC Creator →"**.
- **Template grid (3 cards):**
  1. **2×2 Grid Video** — "Create viral videos with this 4 image grid format (tested & proven to 🔥)"; `Trending`, `20M+ views`.
  2. **Single Fade-in Video** — "Simple format with billions of views – use your imagination to make a viral banger (we will do the editing)"; `Trending`, `500M+ views`.
  3. **AI UGC Creator** — "Create authentic UGC-style videos in seconds…"; `Trending`, `1B+ views`.
  - Each card: format icon, title, description, stats, green **Use Template** button + eye/preview icon.

## Interactions
- **Use Template** → opens a template-specific creation flow (upload images for the grid, pick a clip, etc.) that ultimately produces media handed to the composer (doc 01).
- Eye icon → preview an example output.
- Featured CTA → AI UGC flow.

## Suggested data model / API
```
StudioTemplate: { id, key:'grid-2x2'|'single-fade'|'ai-ugc', title, description,
                  badges:['NEW','AI-Powered','Trending','SUPER HOT'], statLabel,
                  previewUrl, inputsSchema }
```
- `GET /studio/templates` → cards.
- `POST /studio/templates/:key/generate` → media asset(s) → into composer.

## Notes for the clone
- Templates are config-driven cards; the real work is each template's input flow + render pipeline.
- For an MVP, "2×2 Grid Video" (client-side compose 4 images into a grid clip) is the simplest to ship.

# 14 — OAuth Connect Flows (Reference Only)

**Screenshots:**
- `oauth-twitter-x-authorize.png` / `oauth-twitter-x-authorize-loggedin.png` — X/Twitter authorize app
- `oauth-linkedin-consent.png` — LinkedIn permissions
- `oauth-instagram-consent.png` — Instagram permissions (dark)
- `oauth-facebook-continue.png` / `oauth-facebook-connected.png` — Facebook "Continue as…" + success
- `oauth-google-youtube-consent.png` — Google/YouTube scopes
- `oauth-tiktok-authorize.png` — TikTok permissions

> ⚠️ **These screens are hosted by the providers (X, LinkedIn, Meta, Google, TikTok), not by Post-Bridge.** You do **not** build them. They are captured to show what users see after clicking **Connect [Platform]** (doc 09), and which scopes each platform grants. Your clone only builds: the Connect button → redirect to the provider → a callback route that stores tokens.

## What each consent screen authorizes (scopes to request)
- **X / Twitter** (`oauth-twitter-x-authorize*`): "Authorize post bridge to access your account" — read posts/profile, post/create & delete posts, follow/mute/block, manage lists. Need **write (post)** scope at minimum.
- **LinkedIn** (`oauth-linkedin-consent`): create/modify/delete posts & reactions on personal + organization behalf, basic profile, retrieve org posts/engagement, manage org pages/reporting. → `w_member_social`, organization scopes for Pages.
- **Instagram** (`oauth-instagram-consent`): View profile & media (required), **Access and publish content**, Access & manage insights. Via Instagram Login or Facebook Login (Business/Creator).
- **Facebook** (`oauth-facebook-continue` → `oauth-facebook-connected`): "Continue as <name>" → "<name> has been connected to post-bridge" → **Got it**. Grants name/profile + Pages publishing (Meta Graph).
- **Google / YouTube** (`oauth-google-youtube-consent`): "post bridge wants additional access to your Google Account" — see/edit/delete YouTube videos, manage videos, view account. → YouTube Data API upload scope.
- **TikTok** (`oauth-tiktok-authorize`): access profile info, read public videos, **post content to TikTok**, upload draft content. → `video.publish` / `video.upload` scopes.

## Your side of the flow (what you DO build)
```
GET  /connect/:platform/start     → build provider auth URL (client_id, scopes, redirect_uri, state) → 302
GET  /connect/:platform/callback  → exchange code → access/refresh tokens → create SocialAccount → close popup / redirect to /connections
POST /accounts/:id/refresh        → refresh expired tokens
```
- Store per provider: `accessToken`, `refreshToken`, `expiresAt`, `scopes`, `externalUserId`, `pageId` (Meta).
- Use a `state` param (CSRF) and a popup or full-redirect pattern.
- Instagram/Facebook share Meta OAuth — the connect-method modal (doc 09) chooses the path.

## Notes for the clone
- For development without real apps, you can stub these with a mock "Allow/Cancel" page that returns a fake account — but the production flow is provider-hosted.
- Register developer apps per platform to obtain client IDs/secrets and get the requested scopes approved (especially Meta + TikTok content-publishing review).

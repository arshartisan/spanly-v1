# 09 — Connections (Connected Accounts)

**Screenshots:**
- `app-connections.png` — connected accounts list
- `app-connections-instagram-method-modal.png` — choose-connection-method modal

## Purpose
Connect, view, refresh, and remove social accounts per platform. This is where OAuth flows (doc 14) are initiated.

## Layout (`app-connections.png`)
- Title **"Connected Accounts"**. Top-right: **Show IDs** toggle + **all accounts** dropdown + funnel filter.
- **One row per platform**, each: platform icon + dark **"Connect [Platform]"** button + any connected account chips (avatar + name + `×` to disconnect).
  - Platforms shown: **Instagram** (`dev_muhaimin`), **LinkedIn** (`Abdul Muhaimin`), **TikTok** (`devmuhaimin`), **Twitter/X** (`DevMuhaimin2001`), **YouTube** (`Inspirational Grassy Mountain`), **Facebook**, **Bluesky**, **Threads**, **Pinterest**, **Google Business**.
- **Refresh row:** `Refresh Instagram`, `Refresh Twitter`, `Refresh TikTok`, `Refresh YouTube`, `Refresh LinkedIn` (re-auth / re-sync tokens).
- Link: **"Get help connecting your accounts"** (→ help center, doc 13).

## Connect-method modal (`app-connections-instagram-method-modal.png`)
- Title **"Choose your Instagram connection method"**.
- Two option cards:
  - **Login with Instagram** — green **Connect via Instagram**, with bullet requirements.
  - **Login with Facebook** — blue **Connect with Facebook** (for Business/Creator accounts linked to a Page), with bullet requirements.
- **Cancel** link.

## Interactions
- **Connect [Platform]** → opens provider OAuth (doc 14); some platforms (Instagram) first show this method-choice modal.
- `×` on a chip → disconnect (confirm).
- **Refresh [Platform]** → re-run token refresh / re-auth.
- **Show IDs** → reveal internal account IDs (useful for API users).

## Suggested data model / API
```
SocialAccount: { id, platform, handle, displayName, avatarUrl,
                 status:'active'|'expired'|'error', externalId, connectedAt, scopes:[] }
PlatformConfig: { key, label, icon, connectMethods:['oauth'|'facebook'], supportsRefresh }
```
- `GET /accounts` → grouped by platform.
- `GET /connect/:platform/start` → OAuth redirect URL (+ method param for IG).
- `GET /connect/:platform/callback` → stores tokens, creates SocialAccount.
- `POST /accounts/:id/refresh`, `DELETE /accounts/:id`.

## Notes for the clone
- Platform list is static config; account chips are data.
- Instagram/Facebook share Meta OAuth — model the method choice explicitly.
- Token expiry drives the Refresh affordance + account `status`.

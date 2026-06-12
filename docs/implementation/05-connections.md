# 05 — Connections (Connect Social Accounts)

**Design refs:** `../09-connections.md`, `../14-oauth-connect-flows.md`.
**Depends on:** `02` (providers), `01` (SocialAccount), `10` (plan account-limit gating).

## Scope
Connect, list, refresh, and disconnect posting accounts for the **6** platforms. OAuth runs
through the provider abstraction; **MockProvider** drives everything in MVP. Enforce the
**plan account limit** on connect.

## Page `/connections`
- Title "Connected Accounts" + "Show IDs" toggle + filter.
- **One row per platform** (Facebook, Instagram, LinkedIn, TikTok, YouTube, X), each with:
  - platform icon + dark **"Connect [Platform]"** button,
  - connected account chips (avatar + handle + `×` disconnect),
  - a **Refresh** affordance when `status !== active` (token expired/error).
- Instagram's Connect opens a **method-choice modal** first: "Login with Instagram" vs
  "Login with Facebook" (Business/Creator + Page). Choice passed as `?method=`.
- Link: "Get help connecting your accounts" (→ help center, later).

## OAuth routes (our side — design doc 14)
```
GET /api/connect/[platform]/start
    • require session; enforce account limit (doc 10)
    • state = signed { userId, platform, nonce }  (CSRF)
    • redirectUri = APP_URL/api/connect/[platform]/callback
    • provider.getAuthUrl({ state, redirectUri, method? }) → 302 redirect (popup or full)

GET /api/connect/[platform]/callback
    • verify state (CSRF + not expired)
    • provider.handleCallback({ code, redirectUri }) → { tokens, account }
    • encrypt tokens (src/server/crypto.ts, AES-256-GCM)
    • upsert SocialAccount (unique [userId, platform, externalId])
    • set capabilities from provider.capabilities
    • close popup / redirect → /connections?connected=platform

POST /api/accounts/[id]/refresh
    • provider.refresh(tokens) → re-encrypt, update tokenExpiresAt + status=active

DELETE /api/accounts/[id]
    • confirm → delete SocialAccount (cascades PostTarget history? NO — see note)
```
> **Disconnect note:** Deleting a `SocialAccount` cascades its `PostTarget` rows. To preserve
> posted history, prefer a **soft delete** (`status='error'` + `disconnectedAt`) OR detach
> targets. MVP decision: soft-delete account, keep history. Record in `DECISIONS.md`.

## Token encryption (`src/server/crypto.ts`)
```ts
// AES-256-GCM using TOKEN_ENC_KEY (32-byte hex). Store iv+tag+ciphertext.
export function encryptTokens(t: ProviderTokens): string;
export function decryptTokens(blob: string): ProviderTokens;
```
Never log decrypted tokens. Decrypt only at publish/refresh time.

## Mock connect flow (dev)
- `provider.getAuthUrl` returns `/connect/[platform]/mock?state=...` — a small **internal
  page** with "Allow" / "Cancel" buttons.
- "Allow" → posts back to the callback with a fake `code`; `handleCallback` returns a
  deterministic fake account (`handle: demo_<platform>`).
- Lets us connect all 6 with no real apps.

## Account-limit gating (doc 10)
- Before starting OAuth, count active accounts. If `count >= plan.accountLimit`
  (creator 15 / growth 50 / pro ∞), block with an upgrade prompt. Enforce **server-side** in
  `/start` (never trust client).

## Components
- `connections/PlatformRow.tsx`, `AccountChip.tsx`, `InstagramMethodModal.tsx`,
  `ConnectButton.tsx` (opens popup → listens for `postMessage` success).

## Edge cases
- User cancels provider consent → callback has `error` → return to /connections with notice.
- State mismatch/expired → reject (CSRF).
- Re-connecting same external account → upsert (no duplicate), refresh tokens.
- Token refresh fails → set `status='expired'`, surface Refresh button + (later) email alert.
- Hitting account limit mid-flow → friendly upgrade CTA.

## Acceptance criteria
- All 6 platforms connect via MockProvider and show a chip with handle/avatar.
- Disconnect removes the chip (soft-delete) and the account no longer appears in the composer.
- Refresh updates `tokenExpiresAt` and clears `expired` status.
- Connecting beyond the plan limit is blocked server-side.
- Tokens are stored encrypted (verify the DB column is not plaintext).

## Verification
1. From a fresh user, connect each platform via the mock Allow page → 6 chips appear.
2. Inspect `SocialAccount.encryptedTokens` in Studio → ciphertext, not JSON.
3. Set plan to a low limit, attempt to exceed → blocked with upgrade prompt.
4. Disconnect Instagram → it disappears from `/connections` and the composer account row.

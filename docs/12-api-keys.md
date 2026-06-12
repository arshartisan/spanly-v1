# 12 — API Keys

**Screenshot:** `app-api-keys.png`

## Purpose
Manage API keys for programmatic posting + a webhook for post-completion callbacks. Gated behind the paid **API Addon** (doc 11 Billing).

## Layout
- Title **"API Keys"** + subtitle "Manage API keys for programmatic access to your account". Top-right **+ Create API Key** (disabled when addon inactive).
- **Gating banner (yellow):** **"API Access Required"** — "API access is not included in your current subscription. To create and manage API keys, please upgrade your subscription to include API access." + **Manage Billing** button.
- **Keys list / empty state:** key icon, **"No API keys yet"**, "Create your first API key to start using the post bridge API", disabled **+ Create your first API Key**.
- **Webhook** card: "Get notified when a post finishes. We'll send results to your URL signed with **HMAC-SHA256**." + URL input (`https://your-server.com/webhook`) + **Save**.
- **API Documentation** card: "Use your API keys to authenticate requests…" + "Keep your API keys secure and never expose them in client-side code or public repositories." (links to docs).

## UI states
- **Addon inactive:** banner + all create actions disabled (captured state).
- **Addon active:** create enabled; list shows keys (name, masked key, created, last used, revoke).

## Interactions
- **Create API Key** → generate; show secret **once** in a copy-once dialog.
- **Manage Billing** → Billing tab to enable the addon.
- **Save webhook** → store + (ideally) send a test signed event.

## Suggested data model / API
```
ApiKey:  { id, name, maskedKey, createdAt, lastUsedAt }
Webhook: { url, secret, signingAlg:'HMAC-SHA256' }
```
- `GET /api-keys`, `POST /api-keys` (returns plaintext once), `DELETE /api-keys/:id`.
- `GET/PUT /webhook`. Sign payloads with HMAC-SHA256 over the body using the webhook secret.

## Notes for the clone
- Show the secret exactly once; store only a hash + last-4.
- Webhook fires on the publish job terminal state (doc 03) with the per-target results.
- Enforce the addon gate server-side, not just in the UI.

# 02 — Provider Abstraction

## Goal
Isolate every platform-specific concern (OAuth, capabilities, limits, publishing) behind a
single interface so the app is fully buildable/testable with **mock providers** before any
real developer app is approved. Real providers slot in one platform at a time behind a flag.

## Rule
**No platform SDK/HTTP call lives outside `src/providers/<platform>/`.** Services and route
handlers depend only on the `PlatformProvider` interface and the `registry`.

## `src/providers/types.ts`
```ts
export type Capability = 'text' | 'image' | 'video' | 'story';

export interface PlatformLimits {
  captionMax: number;
  mediaMax: number;             // max images/videos per post
  videoMaxSeconds?: number;
  videoMaxBytes?: number;
  imageMaxBytes?: number;
  aspectRatios?: string[];      // e.g. ['1:1','4:5','9:16']
  supportsStory: boolean;
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;           // ISO
  scopes: string[];
  extra?: Record<string, string>; // e.g. pageId for Meta
}

export interface ExternalAccount {
  externalId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  pageId?: string;
}

export interface PublishInput {
  type: 'text' | 'image' | 'video' | 'story';
  caption: string;
  media: { kind: 'image' | 'video' | 'pdf'; url: string; order: number }[];
  idempotencyKey: string;       // PostTarget.idempotencyKey
}

export type PublishResult =
  | { ok: true; externalPostId: string; url?: string }
  | { ok: false; error: string; retryable: boolean };

export interface PlatformProvider {
  readonly platform: Platform;          // 'facebook' | ... | 'x'
  readonly capabilities: Capability[];
  readonly limits: PlatformLimits;

  // OAuth (doc 05/14)
  getAuthUrl(opts: { state: string; redirectUri: string; method?: 'instagram' | 'facebook' }): string;
  handleCallback(opts: { code: string; redirectUri: string }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }>;
  refresh(tokens: ProviderTokens): Promise<ProviderTokens>;

  // Publishing (doc 09)
  publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult>;

  // Validation used by the composer (doc 06)
  validate(input: Omit<PublishInput, 'idempotencyKey'>): { ok: boolean; errors: string[] };
}
```

## `src/providers/registry.ts`
```ts
// Returns the right provider per platform, honoring PROVIDER_MODE.
// PROVIDER_MODE=mock  → MockProvider for ALL platforms.
// PROVIDER_MODE=live  → real provider if implemented + flagged on, else Mock.
export function getProvider(platform: Platform): PlatformProvider { /* ... */ }

// Per-platform live flag (env): PROVIDER_LIVE_X=true etc. Lets us turn on
// real platforms one at a time as approvals land.
```

## MockProvider (`src/providers/mock/`)
The backbone of MVP. One generic class parameterized by platform config.
- `getAuthUrl` → returns an **internal** URL `"/connect/<platform>/mock?state=..."` that
  renders a fake "Allow / Cancel" consent page (built by us, dev only).
- `handleCallback` → returns deterministic fake tokens + a fake `ExternalAccount`
  (`handle: "demo_<platform>"`, random-ish avatar). No network.
- `refresh` → returns tokens with a pushed-out `expiresAt`.
- `publish` → configurable behavior via env/query for testing:
  - default: resolves `{ ok: true, externalPostId, url: "https://mock.spanly/<platform>/<id>" }`
    after a short delay.
  - `MOCK_FAIL_PLATFORMS=tiktok` → that platform returns `{ ok:false, retryable:true }` so
    the failure/retry UI (doc 09) is exercisable.
- `validate` → enforces the same `limits` table as the real provider would.

## Capabilities & limits table (seed values; refine per real API later)
| Platform | capabilities | captionMax | mediaMax | video s | story |
|---|---|---|---|---|---|
| x | text,image,video | 280 | 4 | 140 | no |
| linkedin | text,image,video | 3000 | 9 | 600 | no |
| facebook | text,image,video | 5000 | 10 | 1200 | no |
| instagram | image,video,story | 2200 | 10 | 90 | yes |
| tiktok | image,video | 2200 | 35 | 600 | no |
| youtube | video | 5000 | 1 | 60(shorts)/—| no |

> The composer's caption counter uses the **minimum captionMax** across selected accounts
> (doc 06). Story = exactly 1 media, IG only.

## Real providers (stubs now, implemented in Phase 6)
Each `src/providers/<platform>/index.ts` implements `PlatformProvider`:
- **facebook / instagram** — Meta Graph API; share OAuth; IG needs Business/Creator + Page;
  `extra.pageId` stored. IG method modal chooses `instagram` vs `facebook` login path.
- **linkedin** — OAuth `w_member_social`; UGC Posts API; org scopes for Pages later.
- **tiktok** — Content Posting API (`video.publish`/`video.upload`); audit gating note.
- **youtube** — Google OAuth + YouTube Data API `videos.insert`; quota-aware.
- **x** — OAuth2 PKCE; v2 `POST /2/tweets` + media upload; paid-tier write caps.

Each stub throws `NotImplemented` from `publish` until built, but its `getAuthUrl`/limits/
`validate` can be real early. Until a platform's `PROVIDER_LIVE_<P>` flag is on, the registry
serves Mock.

## Acceptance criteria
- `getProvider(p)` returns MockProvider for all 6 when `PROVIDER_MODE=mock`.
- A full connect→compose→publish cycle works end-to-end with mocks, no real credentials.
- `MOCK_FAIL_PLATFORMS` reliably drives a failed `PostTarget` + retry path.
- No `import` of any platform SDK exists outside `src/providers/`.

## Verification
1. Unit test: `getProvider('x').validate({type:'text',caption:'x'.repeat(300),media:[]})`
   returns `{ ok:false }` (over 280).
2. Integration: connect all 6 mock accounts, schedule a post to all, run worker, see 6
   `PostTarget` successes (or a forced failure when `MOCK_FAIL_PLATFORMS` set).

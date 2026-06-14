/**
 * XProvider — real X (Twitter) integration (docs/implementation/02 + 06 + 09).
 *
 * OAuth 2.0 Authorization Code + PKCE (X requires PKCE even for confidential web apps).
 * We hold no server-side store for the PKCE code_verifier; instead it is derived
 * deterministically from the signed CSRF `state` via HMAC(NEXTAUTH_SECRET, state). The
 * verifier never leaves the server — only the SHA-256 code_challenge is sent to X — so an
 * intercepted redirect cannot reconstruct it without NEXTAUTH_SECRET.
 *
 * Endpoints:
 *   authorize  https://twitter.com/i/oauth2/authorize
 *   token      https://api.twitter.com/2/oauth2/token
 *   me         https://api.twitter.com/2/users/me
 *   tweets     https://api.twitter.com/2/tweets
 *   media      https://upload.twitter.com/1.1/media/upload.json (INIT/APPEND/FINALIZE/STATUS)
 *
 * Requires (env): X_CLIENT_ID, X_CLIENT_SECRET (Web App = confidential client),
 *   NEXTAUTH_SECRET (already required app-wide). Scopes requested:
 *   tweet.read tweet.write users.read offline.access media.write
 */
import crypto from "node:crypto";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import type {
  AuthUrlOptions,
  ExternalAccount,
  PlatformProvider,
  PublishInput,
  PublishMedia,
  PublishResult,
  ProviderTokens,
  ValidationResult,
} from "@/providers/types";

// Use the x.com domain (not twitter.com) for the authorize step so the user's existing
// x.com login session is recognized directly — the cross-domain twitter.com→x.com bridge
// otherwise dumps users on a blank `/i/jf/onboarding/web/sso` interstitial.
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
const TWEETS_URL = "https://api.twitter.com/2/tweets";
const MEDIA_URL = "https://upload.twitter.com/1.1/media/upload.json";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];
const MAX_CHUNK = 4 * 1024 * 1024; // 4 MB per APPEND segment (X limit is 5 MB)

function clientId(): string {
  const id = process.env.X_CLIENT_ID;
  if (!id) throw new Error("X_CLIENT_ID is not set");
  return id;
}

/** Basic auth header for the confidential (web app) token endpoint. */
function basicAuthHeader(): string {
  const id = clientId();
  const secret = process.env.X_CLIENT_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Deterministic, stateless PKCE verifier bound to this flow's signed state. */
function codeVerifier(state: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for X PKCE");
  // 32 bytes → 43-char base64url string (within the 43–128 PKCE range).
  return b64url(crypto.createHmac("sha256", secret).update(`pkce:${state}`).digest());
}

function codeChallenge(verifier: string): string {
  return b64url(crypto.createHash("sha256").update(verifier).digest());
}

/** HTTP 429 / 5xx are transient; everything else (4xx) is a permanent failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function tokensFrom(json: TokenResponse, prev?: ProviderTokens): ProviderTokens {
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : undefined;
  return {
    accessToken: json.access_token,
    // X rotates refresh tokens; fall back to the previous one if absent.
    refreshToken: json.refresh_token ?? prev?.refreshToken,
    expiresAt,
    scopes: json.scope ? json.scope.split(" ") : (prev?.scopes ?? SCOPES),
    extra: prev?.extra,
  };
}

export class XProvider implements PlatformProvider {
  readonly platform = "x" as const;
  readonly capabilities = PLATFORM_CONFIG.x.capabilities;
  readonly limits = PLATFORM_CONFIG.x.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const verifier = codeVerifier(opts.state);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId(),
      redirect_uri: opts.redirectUri,
      scope: SCOPES.join(" "),
      state: opts.state,
      code_challenge: codeChallenge(verifier),
      code_challenge_method: "S256",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
    state?: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    if (!opts.state) throw new Error("Missing OAuth state for X PKCE verification");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: codeVerifier(opts.state),
      client_id: clientId(),
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`X token exchange failed (${res.status}): ${await res.text()}`);
    }
    const tokens = tokensFrom((await res.json()) as TokenResponse);

    // Identify the connected account.
    const meRes = await fetch(`${ME_URL}?user.fields=profile_image_url,name,username`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!meRes.ok) {
      throw new Error(`X users/me failed (${meRes.status}): ${await meRes.text()}`);
    }
    const me = (await meRes.json()) as {
      data: { id: string; username: string; name?: string; profile_image_url?: string };
    };

    // Stash the username so publish() can build a canonical post URL.
    tokens.extra = { ...(tokens.extra ?? {}), username: me.data.username };

    return {
      tokens,
      account: {
        externalId: me.data.id,
        handle: me.data.username,
        displayName: me.data.name,
        avatarUrl: me.data.profile_image_url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for X account");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: clientId(),
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`X token refresh failed (${res.status}): ${await res.text()}`);
    }
    return tokensFrom((await res.json()) as TokenResponse, tokens);
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const mediaIds: string[] = [];
      for (const m of input.media.slice(0, this.limits.mediaMax)) {
        mediaIds.push(await this.uploadMedia(m, tokens.accessToken));
      }

      const payload: { text: string; media?: { media_ids: string[] } } = {
        text: input.caption,
      };
      if (mediaIds.length > 0) payload.media = { media_ids: mediaIds };

      const res = await fetch(TWEETS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          ok: false,
          error: `X publish failed (${res.status}): ${await res.text()}`,
          retryable: isRetryableStatus(res.status),
        };
      }

      const json = (await res.json()) as { data: { id: string } };
      const id = json.data.id;
      const username = tokens.extra?.username;
      const url = username
        ? `https://x.com/${username}/status/${id}`
        : `https://x.com/i/web/status/${id}`;
      return { ok: true, externalPostId: id, url };
    } catch (err) {
      // Network/parse errors are worth a retry.
      return { ok: false, error: `X publish error: ${(err as Error).message}`, retryable: true };
    }
  }

  /** Chunked upload (INIT → APPEND → FINALIZE → STATUS) — works for images and video. */
  private async uploadMedia(media: PublishMedia, accessToken: string): Promise<string> {
    if (media.kind === "pdf") throw new Error("X does not support PDF media");

    const fileRes = await fetch(media.url);
    if (!fileRes.ok) throw new Error(`Could not fetch media (${fileRes.status}): ${media.url}`);
    const contentType =
      fileRes.headers.get("content-type") ??
      (media.kind === "video" ? "video/mp4" : "image/jpeg");
    const bytes = Buffer.from(await fileRes.arrayBuffer());

    const auth = { Authorization: `Bearer ${accessToken}` };
    const category = media.kind === "video" ? "tweet_video" : "tweet_image";

    // INIT
    const initRes = await fetch(MEDIA_URL, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        command: "INIT",
        total_bytes: String(bytes.length),
        media_type: contentType,
        media_category: category,
      }),
    });
    if (!initRes.ok) throw new Error(`media INIT failed (${initRes.status}): ${await initRes.text()}`);
    const mediaId = ((await initRes.json()) as { media_id_string: string }).media_id_string;

    // APPEND (segmented)
    for (let i = 0, seg = 0; i < bytes.length; i += MAX_CHUNK, seg++) {
      const chunk = bytes.subarray(i, Math.min(i + MAX_CHUNK, bytes.length));
      const form = new FormData();
      form.set("command", "APPEND");
      form.set("media_id", mediaId);
      form.set("segment_index", String(seg));
      form.set("media", new Blob([chunk], { type: "application/octet-stream" }));
      const appendRes = await fetch(MEDIA_URL, { method: "POST", headers: auth, body: form });
      if (!appendRes.ok) {
        throw new Error(`media APPEND failed (${appendRes.status}): ${await appendRes.text()}`);
      }
    }

    // FINALIZE
    const finRes = await fetch(MEDIA_URL, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }),
    });
    if (!finRes.ok) throw new Error(`media FINALIZE failed (${finRes.status}): ${await finRes.text()}`);
    let fin = (await finRes.json()) as {
      processing_info?: { state: string; check_after_secs?: number };
    };

    // Poll async processing (video) until succeeded/failed.
    let waited = 0;
    while (fin.processing_info && fin.processing_info.state !== "succeeded") {
      if (fin.processing_info.state === "failed") throw new Error("X media processing failed");
      const wait = Math.min(fin.processing_info.check_after_secs ?? 2, 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      waited += wait;
      if (waited > 120) throw new Error("X media processing timed out");
      const statusRes = await fetch(
        `${MEDIA_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
        { headers: auth },
      );
      if (!statusRes.ok) throw new Error(`media STATUS failed (${statusRes.status})`);
      fin = (await statusRes.json()) as typeof fin;
    }

    return mediaId;
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`X does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for X`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for X`);
    }
    if ((input.type === "image" || input.type === "video") && input.media.length === 0) {
      errors.push(`${input.type} posts require at least one media item`);
    }
    if (input.type === "text" && input.caption.trim().length === 0) {
      errors.push("Text posts require a caption");
    }
    return { ok: errors.length === 0, errors };
  }
}

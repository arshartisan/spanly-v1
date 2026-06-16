/**
 * YoutubeProvider — real YouTube (Shorts) publishing (docs/implementation/02 + 06 + 09).
 *
 * OAuth 2.0 Authorization Code (no PKCE — this is a confidential web app with a client
 * secret). Google only returns a refresh_token when the consent screen is forced, so the
 * auth URL requests `access_type=offline` + `prompt=consent`; access tokens otherwise expire
 * in ~1h and refresh() relies on that long-lived refresh_token. The signed CSRF `state` is
 * echoed back and verified by the caller.
 *
 * Endpoints:
 *   authorize  https://accounts.google.com/o/oauth2/v2/auth
 *   token      https://oauth2.googleapis.com/token
 *   channels   https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true
 *   upload     https://www.googleapis.com/upload/youtube/v3/videos   (resumable)
 *
 * Publishing uses the YouTube Data API v3 resumable upload:
 *   1. POST the video metadata (snippet + status) → Google returns a session URL (Location)
 *   2. PUT the video bytes to that session URL → Google returns the created video resource
 *
 * There is no API flag for Shorts: a video is treated as a Short when it is vertical/square
 * and short (currently <=3 min). We append #Shorts to the description as the conventional
 * nudge; the actual classification is YouTube's based on the uploaded media's aspect/length.
 *
 * Requires (env): YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET, or the shared GOOGLE_CLIENT_ID +
 * GOOGLE_CLIENT_SECRET as a fallback. Optional YOUTUBE_PRIVACY_STATUS (public | unlisted |
 * private; defaults to public). Scopes requested: youtube.upload, youtube.readonly, openid,
 * userinfo.profile.
 */
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

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const TITLE_MAX = 100; // YouTube caps video titles at 100 chars.

// Prefer a dedicated YouTube OAuth client, but fall back to the shared GOOGLE_* credentials
// (the same Google Cloud OAuth client used for sign-in) when YOUTUBE_* isn't configured. To
// reuse it, the YouTube scopes must be on that client's consent screen and the
// /api/connect/youtube/callback redirect URI registered on it.
function clientId(): string {
  const id = process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("YOUTUBE_CLIENT_ID (or GOOGLE_CLIENT_ID) is not set");
  return id;
}

function clientSecret(): string {
  const secret = process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("YOUTUBE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET) is not set");
  return secret;
}

/** public (default) | unlisted | private — overridable per deployment. */
function privacyStatus(): string {
  const v = process.env.YOUTUBE_PRIVACY_STATUS;
  return v === "private" || v === "unlisted" ? v : "public";
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
    // Google only returns a refresh_token on the first consent; keep the previous one on refresh.
    refreshToken: json.refresh_token ?? prev?.refreshToken,
    expiresAt,
    scopes: json.scope ? json.scope.split(" ") : (prev?.scopes ?? SCOPES),
    extra: prev?.extra,
  };
}

/** Derive a <=100-char title from the caption's first line; the full caption is the description. */
function deriveTitle(caption: string): string {
  const firstLine = caption.split("\n", 1)[0]?.trim() ?? "";
  const base = firstLine.length > 0 ? firstLine : caption.trim();
  const title = base.slice(0, TITLE_MAX).trim();
  return title.length > 0 ? title : "Untitled";
}

/** Append the #Shorts hint to the description if it isn't already present. */
function withShortsHint(caption: string): string {
  return /#shorts\b/i.test(caption) ? caption : `${caption}\n\n#Shorts`.trim();
}

interface ChannelSnippet {
  title?: string;
  thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
}

export class YoutubeProvider implements PlatformProvider {
  readonly platform = "youtube" as const;
  readonly capabilities = PLATFORM_CONFIG.youtube.capabilities;
  readonly limits = PLATFORM_CONFIG.youtube.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId(),
      redirect_uri: opts.redirectUri,
      scope: SCOPES.join(" "), // Google uses space-separated scopes
      state: opts.state,
      // Force a refresh_token to come back and survive re-consent.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
    state?: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: opts.code,
        redirect_uri: opts.redirectUri,
        client_id: clientId(),
        client_secret: clientSecret(),
      }),
    });
    if (!res.ok) {
      throw new Error(`YouTube token exchange failed (${res.status}): ${await res.text()}`);
    }
    const tokens = tokensFrom((await res.json()) as TokenResponse);

    const channel = await this.fetchChannel(tokens.accessToken);

    return {
      tokens,
      account: {
        externalId: channel.id,
        handle: channel.snippet?.title ?? channel.id,
        displayName: channel.snippet?.title,
        avatarUrl:
          channel.snippet?.thumbnails?.default?.url ?? channel.snippet?.thumbnails?.medium?.url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for YouTube account");
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: clientId(),
        client_secret: clientSecret(),
      }),
    });
    if (!res.ok) {
      throw new Error(`YouTube token refresh failed (${res.status}): ${await res.text()}`);
    }
    return tokensFrom((await res.json()) as TokenResponse, tokens);
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const media = input.media.find((m) => m.kind === "video");
      if (!media) {
        return { ok: false, error: "YouTube post requires a video media item", retryable: false };
      }

      // Fetch the bytes (the media URL must be publicly reachable from the worker).
      const fileRes = await fetch(media.url);
      if (!fileRes.ok) {
        return {
          ok: false,
          error: `Could not fetch media (${fileRes.status}): ${media.url}`,
          retryable: isRetryableStatus(fileRes.status),
        };
      }
      const contentType = fileRes.headers.get("content-type") ?? "video/mp4";
      const bytes = Buffer.from(await fileRes.arrayBuffer());

      // Step 1 — start a resumable upload session with the video metadata.
      const metadata = {
        snippet: {
          title: deriveTitle(input.caption),
          description: withShortsHint(input.caption),
        },
        status: { privacyStatus: privacyStatus() },
      };
      const initRes = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": String(bytes.length),
        },
        body: JSON.stringify(metadata),
      });
      if (!initRes.ok) {
        return {
          ok: false,
          error: `YouTube upload init failed (${initRes.status}): ${await initRes.text()}`,
          retryable: isRetryableStatus(initRes.status),
        };
      }
      const sessionUrl = initRes.headers.get("location");
      if (!sessionUrl) {
        return { ok: false, error: "YouTube did not return a resumable upload URL", retryable: true };
      }

      // Step 2 — PUT the bytes to the session URL in a single request.
      const putRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(bytes.length),
        },
        body: bytes,
      });
      if (!putRes.ok) {
        return {
          ok: false,
          error: `YouTube upload failed (${putRes.status}): ${await putRes.text()}`,
          retryable: isRetryableStatus(putRes.status),
        };
      }

      const video = (await putRes.json()) as { id?: string };
      const videoId = video.id;
      if (!videoId) {
        return { ok: false, error: "YouTube upload returned no video id", retryable: true };
      }
      return {
        ok: true,
        externalPostId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (err) {
      // Network/parse errors are worth a retry.
      return { ok: false, error: `YouTube publish error: ${(err as Error).message}`, retryable: true };
    }
  }

  /** Fetch the connected user's channel (id, title, avatar). */
  private async fetchChannel(
    accessToken: string,
  ): Promise<{ id: string; snippet?: ChannelSnippet }> {
    const res = await fetch(`${CHANNELS_URL}?${new URLSearchParams({ part: "snippet", mine: "true" })}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`YouTube channel lookup failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { items?: Array<{ id: string; snippet?: ChannelSnippet }> };
    const channel = json.items?.[0];
    if (!channel?.id) {
      throw new Error("Could not resolve a YouTube channel for this account");
    }
    return channel;
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`YouTube does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for YouTube`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for YouTube`);
    }
    if (input.type === "video" && input.media.length === 0) {
      errors.push("video posts require at least one media item");
    }
    if (input.media.some((m: PublishMedia) => m.kind !== "video")) {
      errors.push("YouTube only supports video media");
    }
    return { ok: errors.length === 0, errors };
  }
}

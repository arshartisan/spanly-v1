/**
 * TiktokProvider — real TikTok Content Posting (docs/implementation/02 + 06 + 09).
 *
 * OAuth 2.0 Authorization Code + PKCE (TikTok Login Kit). Like XProvider we hold no
 * server-side store for the PKCE code_verifier; it is derived deterministically from the
 * signed CSRF `state` via HMAC(NEXTAUTH_SECRET, state), so only the SHA-256 code_challenge
 * ever leaves the server. TikTok also requires the confidential client_secret at token
 * exchange, which we send alongside the verifier.
 *
 * Endpoints:
 *   authorize    https://www.tiktok.com/v2/auth/authorize/
 *   token        https://open.tiktokapis.com/v2/oauth/token/
 *   user info    https://open.tiktokapis.com/v2/user/info/
 *   creator info https://open.tiktokapis.com/v2/post/publish/creator_info/query/
 *   video init   https://open.tiktokapis.com/v2/post/publish/video/init/
 *   content init https://open.tiktokapis.com/v2/post/publish/content/init/   (photos)
 *   status       https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *
 * Publishing uses TikTok's Direct Post flow:
 *   1. query creator_info to get the account's allowed privacy_level_options
 *   2. init the post (video → FILE_UPLOAD; photo → PULL_FROM_URL) → a publish_id
 *   3. (video) PUT the bytes to the returned upload_url in <=64 MB chunks
 *   4. poll status/fetch on the publish_id until PUBLISH_COMPLETE / FAILED
 *
 * Videos use FILE_UPLOAD (we fetch the bytes and push them) so no developer-portal domain
 * verification is needed. Photos only support PULL_FROM_URL — the media URL's domain must be
 * verified in the TikTok app settings for those to succeed.
 *
 * Requires (env): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, NEXTAUTH_SECRET (app-wide).
 * Scopes requested: user.info.basic, video.publish.
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

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const VIDEO_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const CONTENT_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const SCOPES = ["user.info.basic", "video.publish"];
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB — TikTok's max chunk size for FILE_UPLOAD

function clientKey(): string {
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key) throw new Error("TIKTOK_CLIENT_KEY is not set");
  return key;
}
function clientSecret(): string {
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!secret) throw new Error("TIKTOK_CLIENT_SECRET is not set");
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Deterministic, stateless PKCE verifier bound to this flow's signed state (see XProvider). */
function codeVerifier(state: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for TikTok PKCE");
  return b64url(crypto.createHmac("sha256", secret).update(`pkce:${state}`).digest());
}

/** TikTok requires the challenge as a lowercase hex SHA-256 (not base64url like most providers). */
function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("hex");
}

/** HTTP 429 / 5xx are transient; everything else (4xx) is a permanent failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Error carrying retry semantics derived from the HTTP status (or TikTok error envelope). */
class TiktokHttpError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  open_id?: string;
  token_type?: string;
}

/** TikTok wraps every API response in { data, error } — error.code === "ok" means success. */
interface TiktokEnvelope<T> {
  data?: T;
  error?: { code: string; message?: string; log_id?: string };
}

function tokensFrom(json: TokenResponse, prev?: ProviderTokens): ProviderTokens {
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : undefined;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? prev?.refreshToken,
    expiresAt,
    scopes: json.scope ? json.scope.split(",") : (prev?.scopes ?? SCOPES),
    extra: {
      ...(prev?.extra ?? {}),
      ...(json.open_id ? { openId: json.open_id } : {}),
    },
  };
}

export class TiktokProvider implements PlatformProvider {
  readonly platform = "tiktok" as const;
  readonly capabilities = PLATFORM_CONFIG.tiktok.capabilities;
  readonly limits = PLATFORM_CONFIG.tiktok.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const verifier = codeVerifier(opts.state);
    const params = new URLSearchParams({
      client_key: clientKey(),
      response_type: "code",
      scope: SCOPES.join(","), // TikTok uses comma-separated scopes
      redirect_uri: opts.redirectUri,
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
    if (!opts.state) throw new Error("Missing OAuth state for TikTok PKCE verification");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey(),
        client_secret: clientSecret(),
        code: opts.code,
        grant_type: "authorization_code",
        redirect_uri: opts.redirectUri,
        code_verifier: codeVerifier(opts.state),
      }),
    });
    if (!res.ok) {
      throw new Error(`TikTok token exchange failed (${res.status}): ${await res.text()}`);
    }
    const tokens = tokensFrom((await res.json()) as TokenResponse);

    const user = await this.fetchUser(tokens.accessToken);
    const externalId = user.open_id ?? tokens.extra?.openId ?? "";
    if (!externalId) throw new Error("Could not resolve TikTok open_id");

    return {
      tokens,
      account: {
        externalId,
        handle: user.display_name ?? externalId,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for TikTok account");
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey(),
        client_secret: clientSecret(),
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });
    if (!res.ok) {
      throw new Error(`TikTok token refresh failed (${res.status}): ${await res.text()}`);
    }
    return tokensFrom((await res.json()) as TokenResponse, tokens);
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const token = tokens.accessToken;
      const media = input.media.slice(0, this.limits.mediaMax);
      const privacyLevel = await this.resolvePrivacyLevel(token);

      const isVideo = input.type === "video" || media.some((m) => m.kind === "video");
      const publishId = isVideo
        ? await this.initAndUploadVideo(input.caption, media, privacyLevel, token)
        : await this.initPhoto(input.caption, media, privacyLevel, token);

      const postId = await this.waitForPublish(publishId, token);
      const url = postId ? `https://www.tiktok.com/video/${postId}` : undefined;
      return { ok: true, externalPostId: publishId, url };
    } catch (err) {
      const retryable = err instanceof TiktokHttpError ? err.retryable : true;
      return { ok: false, error: `TikTok publish error: ${(err as Error).message}`, retryable };
    }
  }

  /** POST a TikTok JSON endpoint and unwrap its { data, error } envelope. */
  private async postJson<T>(url: string, token: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new TiktokHttpError(`TikTok ${url} failed (${res.status}): ${text}`, isRetryableStatus(res.status));
    }
    const json = JSON.parse(text) as TiktokEnvelope<T>;
    if (json.error && json.error.code !== "ok") {
      // TikTok returns rate-limit / transient errors with a 200 + error.code envelope.
      const retryable = /rate_limit|internal|server/i.test(json.error.code);
      throw new TiktokHttpError(`TikTok ${url} error: ${json.error.code} ${json.error.message ?? ""}`, retryable);
    }
    return json.data as T;
  }

  /** Query creator_info and pick a usable privacy level from the account's allowed options. */
  private async resolvePrivacyLevel(token: string): Promise<string> {
    const data = await this.postJson<{ privacy_level_options?: string[] }>(CREATOR_INFO_URL, token, {});
    const options = data?.privacy_level_options ?? [];
    // Public when the account allows it (audited app + public account). Otherwise prefer
    // SELF_ONLY ("Only me") — this is the only level an unaudited/sandbox client may use, and
    // it's the safest default for a private account rather than silently posting follower-visible.
    if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
    if (options.includes("SELF_ONLY")) return "SELF_ONLY";
    return options[0] ?? "SELF_ONLY";
  }

  /** Video Direct Post via FILE_UPLOAD: init → chunked PUT → returns the publish_id. */
  private async initAndUploadVideo(
    caption: string,
    media: PublishMedia[],
    privacyLevel: string,
    token: string,
  ): Promise<string> {
    const m = media.find((x) => x.kind === "video");
    if (!m) throw new TiktokHttpError("TikTok video post requires a video media item", false);

    const fileRes = await fetch(m.url);
    if (!fileRes.ok) throw new TiktokHttpError(`Could not fetch media (${fileRes.status}): ${m.url}`, true);
    const contentType = fileRes.headers.get("content-type") ?? "video/mp4";
    const bytes = Buffer.from(await fileRes.arrayBuffer());

    // <=64 MB → one chunk; otherwise full chunks with the remainder folded into the last one.
    const totalChunks = bytes.length <= CHUNK_SIZE ? 1 : Math.floor(bytes.length / CHUNK_SIZE);
    const chunkSize = totalChunks === 1 ? bytes.length : CHUNK_SIZE;

    const data = await this.postJson<{ publish_id: string; upload_url: string }>(VIDEO_INIT_URL, token, {
      post_info: {
        title: caption,
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: bytes.length,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      // The last chunk absorbs any remainder bytes.
      const end = i === totalChunks - 1 ? bytes.length - 1 : start + chunkSize - 1;
      const chunk = bytes.subarray(start, end + 1);
      const putRes = await fetch(data.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        },
        body: chunk,
      });
      if (!putRes.ok) {
        throw new TiktokHttpError(
          `TikTok video chunk upload failed (${putRes.status}): ${await putRes.text()}`,
          isRetryableStatus(putRes.status),
        );
      }
    }

    return data.publish_id;
  }

  /** Photo Direct Post via PULL_FROM_URL (image domains must be verified in the app settings). */
  private async initPhoto(
    caption: string,
    media: PublishMedia[],
    privacyLevel: string,
    token: string,
  ): Promise<string> {
    const images = media.filter((m) => m.kind === "image").map((m) => m.url);
    if (images.length === 0) throw new TiktokHttpError("TikTok photo post requires at least one image", false);

    const data = await this.postJson<{ publish_id: string }>(CONTENT_INIT_URL, token, {
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      post_info: {
        title: caption.slice(0, 90), // photo title caps at 90 chars
        description: caption,
        privacy_level: privacyLevel,
        disable_comment: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: images,
      },
    });
    return data.publish_id;
  }

  /** Poll status/fetch until the post is published; returns a public post id when available. */
  private async waitForPublish(
    publishId: string,
    token: string,
    maxAttempts = 30,
    delayMs = 3000,
  ): Promise<string | undefined> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const data = await this.postJson<{
        status?: string;
        fail_reason?: string;
        publicaly_available_post_id?: Array<string | number>;
      }>(STATUS_URL, token, { publish_id: publishId });

      if (data?.status === "PUBLISH_COMPLETE") {
        const id = data.publicaly_available_post_id?.[0];
        return id != null ? String(id) : undefined;
      }
      if (data?.status === "FAILED") {
        throw new TiktokHttpError(`TikTok publish failed: ${data.fail_reason ?? "unknown"}`, false);
      }
      await sleep(delayMs);
    }
    throw new TiktokHttpError("TikTok publish processing timed out", true);
  }

  private async fetchUser(accessToken: string): Promise<{
    open_id?: string;
    display_name?: string;
    avatar_url?: string;
  }> {
    // Only request fields covered by user.info.basic — `username` needs user.info.profile,
    // and asking for a field outside the granted scopes makes the whole request error out.
    const res = await fetch(`${USER_INFO_URL}?${new URLSearchParams({
      fields: "open_id,union_id,avatar_url,display_name",
    })}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`TikTok user info failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as TiktokEnvelope<{
      user?: { open_id?: string; display_name?: string; avatar_url?: string };
    }>;
    if (json.error && json.error.code !== "ok") {
      throw new Error(`TikTok user info error: ${json.error.code} ${json.error.message ?? ""}`);
    }
    return json.data?.user ?? {};
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`TikTok does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for TikTok`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for TikTok`);
    }
    if ((input.type === "image" || input.type === "video") && input.media.length === 0) {
      errors.push(`${input.type} posts require at least one media item`);
    }
    return { ok: errors.length === 0, errors };
  }
}

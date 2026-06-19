/**
 * ThreadsProvider - real Threads (Meta) content publishing (docs/implementation/02 + 06 + 09).
 *
 * Threads is a near-twin of Instagram's API but with its own host (graph.threads.net) and an
 * extra text-only post type. OAuth is a single direct path (no Facebook-Page variant):
 *   authorize  https://threads.net/oauth/authorize
 *   token      https://graph.threads.net/oauth/access_token            (short-lived)
 *   long-lived https://graph.threads.net/access_token?grant_type=th_exchange_token
 *   refresh    https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token
 *   publish    https://graph.threads.net/<v>/<threads-user-id>/threads(+_publish)
 * Scopes: threads_basic, threads_content_publish. Creds: THREADS_CLIENT_ID / THREADS_CLIENT_SECRET.
 *
 * Publishing uses Threads' two-step container flow (same as Instagram):
 *   1. POST .../threads          → a creation_id (the "container")
 *   2. (video) poll the container until status = FINISHED
 *   3. POST .../threads_publish   → the published media id
 * Carousels create one child container per item (is_carousel_item=true), then a CAROUSEL
 * container referencing them. Text-only posts use media_type=TEXT with no media url.
 *
 * Note: the caption param is `text` (not `caption`), and image_url / video_url must be
 * PUBLICLY reachable - Threads fetches the bytes itself.
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

/** Graph version used for the publish endpoints (override via env as versions roll forward). */
const THREADS_VERSION = process.env.THREADS_VERSION ?? "v1.0";
const GRAPH = `https://graph.threads.net/${THREADS_VERSION}`;

const AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_TOKEN_URL = "https://graph.threads.net/access_token";
const REFRESH_URL = "https://graph.threads.net/refresh_access_token";
const SCOPES = ["threads_basic", "threads_content_publish"];

function clientId(): string {
  const id = process.env.THREADS_CLIENT_ID;
  if (!id) throw new Error("THREADS_CLIENT_ID is not set");
  return id;
}
function clientSecret(): string {
  const secret = process.env.THREADS_CLIENT_SECRET;
  if (!secret) throw new Error("THREADS_CLIENT_SECRET is not set");
  return secret;
}

/** HTTP 429 / 5xx are transient; everything else (4xx) is a permanent failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Error carrying the retry semantics derived from the HTTP status that produced it. */
class ThreadsHttpError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ThreadsTokenResponse {
  access_token: string;
  user_id?: string | number;
}
interface ThreadsLongTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export class ThreadsProvider implements PlatformProvider {
  readonly platform = "threads" as const;
  readonly capabilities = PLATFORM_CONFIG.threads.capabilities;
  readonly limits = PLATFORM_CONFIG.threads.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const params = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: opts.redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state: opts.state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    // 1. Code → short-lived token (form-encoded POST), returns { access_token, user_id }.
    const shortRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: "authorization_code",
        redirect_uri: opts.redirectUri,
        code: opts.code,
      }),
    });
    if (!shortRes.ok) {
      throw new Error(`Threads token exchange failed (${shortRes.status}): ${await shortRes.text()}`);
    }
    const short = (await shortRes.json()) as ThreadsTokenResponse;

    // 2. Short → long-lived token (~60 days).
    const longUrl = `${LONG_TOKEN_URL}?${new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: clientSecret(),
      access_token: short.access_token,
    })}`;
    const longRes = await fetch(longUrl);
    if (!longRes.ok) {
      throw new Error(`Threads long-lived exchange failed (${longRes.status}): ${await longRes.text()}`);
    }
    const long = (await longRes.json()) as ThreadsLongTokenResponse;
    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : undefined;

    // 3. Resolve the Threads user id + handle for publishing.
    const me = await this.fetchProfile(long.access_token);
    const threadsUserId = me.id ?? (short.user_id != null ? String(short.user_id) : "");
    if (!threadsUserId) throw new Error("Could not resolve Threads user id");

    return {
      tokens: {
        accessToken: long.access_token,
        expiresAt,
        scopes: SCOPES,
        extra: { threadsUserId },
      },
      account: {
        externalId: threadsUserId,
        handle: me.username ?? threadsUserId,
        displayName: me.username,
        avatarUrl: me.threads_profile_picture_url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    // Long-lived tokens are refreshed in place (must be >24h old, <60d).
    const url = `${REFRESH_URL}?${new URLSearchParams({
      grant_type: "th_refresh_token",
      access_token: tokens.accessToken,
    })}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Threads token refresh failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as ThreadsLongTokenResponse;
    return {
      ...tokens,
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : tokens.expiresAt,
    };
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const userId = tokens.extra?.threadsUserId;
      if (!userId) throw new Error("Missing Threads user id for publish");
      const token = tokens.accessToken;

      const media = input.media.slice(0, this.limits.mediaMax);
      let creationId: string;

      if (media.length > 1) {
        // Carousel: one child container per item, then a CAROUSEL container referencing them.
        const childIds: string[] = [];
        for (const m of media) {
          const childId = await this.createContainer(userId, token, {
            ...this.mediaParams(m),
            is_carousel_item: "true",
          });
          await this.waitForContainer(token, childId);
          childIds.push(childId);
        }
        creationId = await this.createContainer(userId, token, {
          media_type: "CAROUSEL",
          text: input.caption,
          children: childIds.join(","),
        });
      } else if (media.length === 1) {
        creationId = await this.createContainer(userId, token, {
          ...this.mediaParams(media[0]),
          text: input.caption,
        });
      } else {
        // Text-only post.
        creationId = await this.createContainer(userId, token, {
          media_type: "TEXT",
          text: input.caption,
        });
      }

      // Videos are processed asynchronously - wait for the container to be ready.
      await this.waitForContainer(token, creationId);

      const mediaId = await this.publishContainer(userId, token, creationId);
      const url = await this.permalink(token, mediaId);
      return { ok: true, externalPostId: mediaId, url };
    } catch (err) {
      const retryable = err instanceof ThreadsHttpError ? err.retryable : true;
      return { ok: false, error: `Threads publish error: ${(err as Error).message}`, retryable };
    }
  }

  /** Container params for a single post item or a carousel child. */
  private mediaParams(media: PublishMedia): Record<string, string> {
    return media.kind === "video"
      ? { media_type: "VIDEO", video_url: media.url }
      : { media_type: "IMAGE", image_url: media.url };
  }

  private async createContainer(
    userId: string,
    token: string,
    fields: Record<string, string>,
  ): Promise<string> {
    const res = await fetch(`${GRAPH}/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, access_token: token }),
    });
    if (!res.ok) {
      throw new ThreadsHttpError(
        `Threads container failed (${res.status}): ${await res.text()}`,
        isRetryableStatus(res.status),
      );
    }
    return ((await res.json()) as { id: string }).id;
  }

  private async publishContainer(
    userId: string,
    token: string,
    creationId: string,
  ): Promise<string> {
    const res = await fetch(`${GRAPH}/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    if (!res.ok) {
      throw new ThreadsHttpError(
        `Threads threads_publish failed (${res.status}): ${await res.text()}`,
        isRetryableStatus(res.status),
      );
    }
    return ((await res.json()) as { id: string }).id;
  }

  /** Poll a container until it finishes processing (text/images are usually FINISHED at once). */
  private async waitForContainer(
    token: string,
    creationId: string,
    maxAttempts = 20,
    delayMs = 3000,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(
        `${GRAPH}/${creationId}?${new URLSearchParams({ fields: "status", access_token: token })}`,
      );
      if (!res.ok) {
        throw new ThreadsHttpError(
          `Threads container status check failed (${res.status}): ${await res.text()}`,
          isRetryableStatus(res.status),
        );
      }
      const status = ((await res.json()) as { status?: string }).status;
      if (status === "FINISHED") return;
      if (status === "ERROR" || status === "EXPIRED") {
        throw new ThreadsHttpError(`Threads container ${status}`, false);
      }
      await sleep(delayMs);
    }
    throw new ThreadsHttpError("Threads container processing timed out", true);
  }

  /** Best-effort permalink for the published media; omitted if the lookup fails. */
  private async permalink(token: string, mediaId: string): Promise<string | undefined> {
    try {
      const res = await fetch(
        `${GRAPH}/${mediaId}?${new URLSearchParams({ fields: "permalink", access_token: token })}`,
      );
      if (!res.ok) return undefined;
      return ((await res.json()) as { permalink?: string }).permalink;
    } catch {
      return undefined;
    }
  }

  private async fetchProfile(accessToken: string): Promise<{
    id?: string;
    username?: string;
    threads_profile_picture_url?: string;
  }> {
    const res = await fetch(
      `${GRAPH}/me?${new URLSearchParams({
        fields: "id,username,threads_profile_picture_url",
        access_token: accessToken,
      })}`,
    );
    if (!res.ok) {
      throw new Error(`Threads profile lookup failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as {
      id?: string | number;
      username?: string;
      threads_profile_picture_url?: string;
    };
    return {
      id: json.id != null ? String(json.id) : undefined,
      username: json.username,
      threads_profile_picture_url: json.threads_profile_picture_url,
    };
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`Threads does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for Threads`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for Threads`);
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

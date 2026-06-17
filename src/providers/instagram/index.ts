/**
 * InstagramProvider - real Instagram content publishing (docs/implementation/02 + 06 + 09).
 *
 * Instagram can be connected two ways (the user picks in InstagramMethodModal, forwarded as
 * `opts.method` and echoed back in the signed state):
 *
 *  - method "instagram"  → **Instagram API with Instagram Login** (the direct path).
 *      authorize  https://www.instagram.com/oauth/authorize
 *      token      https://api.instagram.com/oauth/access_token            (short-lived)
 *      long-lived https://graph.instagram.com/access_token?grant_type=ig_exchange_token
 *      publish    https://graph.instagram.com/<v>/<ig-user-id>/media(+_publish)
 *      creds: INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET (the *Instagram* app id/secret,
 *      not the top-level Facebook App ID). Scopes: instagram_business_basic,
 *      instagram_business_content_publish.
 *
 *  - method "facebook"   → **Instagram Graph API via a linked Facebook Page**.
 *      Same OAuth as FacebookProvider (www.facebook.com/<v>/dialog/oauth), then resolve the
 *      Page's connected instagram_business_account and publish via graph.facebook.com using
 *      the Page token. creds: FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET. Scopes:
 *      instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement,
 *      business_management.
 *
 * Both paths converge on Instagram's two-step container publish flow:
 *   1. POST .../media          → a creation_id (the "container")
 *   2. (video/reels) poll the container until status_code = FINISHED
 *   3. POST .../media_publish   → the published media id
 * Carousels create one child container per item, then a CAROUSEL container referencing them.
 *
 * Note: image_url / video_url must be PUBLICLY reachable - Instagram fetches the bytes itself.
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
const GRAPH_VERSION = process.env.INSTAGRAM_VERSION ?? "v21.0";
const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const FB_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Instagram-login (direct) endpoints + scopes.
const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_LONG_TOKEN_URL = "https://graph.instagram.com/access_token";
const IG_REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

// Facebook-login (Page-linked IG account) endpoints + scopes.
const FB_AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const FB_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

function igClientId(): string {
  const id = process.env.INSTAGRAM_CLIENT_ID;
  if (!id) throw new Error("INSTAGRAM_CLIENT_ID is not set");
  return id;
}
function igClientSecret(): string {
  const secret = process.env.INSTAGRAM_CLIENT_SECRET;
  if (!secret) throw new Error("INSTAGRAM_CLIENT_SECRET is not set");
  return secret;
}
function fbClientId(): string {
  const id = process.env.FACEBOOK_CLIENT_ID;
  if (!id) throw new Error("FACEBOOK_CLIENT_ID is not set");
  return id;
}
function fbClientSecret(): string {
  const secret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!secret) throw new Error("FACEBOOK_CLIENT_SECRET is not set");
  return secret;
}

/** HTTP 429 / 5xx are transient; everything else (4xx) is a permanent failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Error carrying the retry semantics derived from the HTTP status that produced it. */
class IgHttpError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface IgTokenResponse {
  access_token: string;
  user_id?: string | number;
  permissions?: string;
}
interface IgLongTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}
interface FbUserTokenResponse {
  access_token: string;
  expires_in?: number;
}
interface IgBusinessAccount {
  id: string;
  username?: string;
  profile_picture_url?: string;
}
interface FbPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: IgBusinessAccount;
}

export class InstagramProvider implements PlatformProvider {
  readonly platform = "instagram" as const;
  readonly capabilities = PLATFORM_CONFIG.instagram.capabilities;
  readonly limits = PLATFORM_CONFIG.instagram.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    if (opts.method === "facebook") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: fbClientId(),
        redirect_uri: opts.redirectUri,
        scope: FB_SCOPES.join(","), // Facebook uses comma-separated scopes
        state: opts.state,
      });
      return `${FB_AUTHORIZE_URL}?${params.toString()}`;
    }
    // Default: direct Instagram login.
    const params = new URLSearchParams({
      client_id: igClientId(),
      redirect_uri: opts.redirectUri,
      response_type: "code",
      scope: IG_SCOPES.join(","),
      state: opts.state,
    });
    return `${IG_AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
    state?: string;
    method?: "instagram" | "facebook";
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    return opts.method === "facebook"
      ? this.handleFacebookCallback(opts)
      : this.handleInstagramCallback(opts);
  }

  /** Direct Instagram-login token exchange (short → long-lived) + profile lookup. */
  private async handleInstagramCallback(opts: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    // 1. Code → short-lived token (form-encoded POST). Newer responses wrap in { data: [...] }.
    const shortRes = await fetch(IG_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: igClientId(),
        client_secret: igClientSecret(),
        grant_type: "authorization_code",
        redirect_uri: opts.redirectUri,
        code: opts.code,
      }),
    });
    if (!shortRes.ok) {
      throw new Error(`Instagram token exchange failed (${shortRes.status}): ${await shortRes.text()}`);
    }
    const shortJson = (await shortRes.json()) as IgTokenResponse | { data: IgTokenResponse[] };
    const short = "data" in shortJson ? shortJson.data[0] : shortJson;

    // 2. Short → long-lived token (~60 days).
    const longUrl = `${IG_LONG_TOKEN_URL}?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: igClientSecret(),
      access_token: short.access_token,
    })}`;
    const longRes = await fetch(longUrl);
    if (!longRes.ok) {
      throw new Error(`Instagram long-lived exchange failed (${longRes.status}): ${await longRes.text()}`);
    }
    const long = (await longRes.json()) as IgLongTokenResponse;
    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : undefined;

    // 3. Resolve the IG user id + handle for publishing.
    const me = await this.fetchInstagramProfile(long.access_token);
    const igUserId = me.user_id ?? String(short.user_id ?? "");
    if (!igUserId) throw new Error("Could not resolve Instagram user id");

    return {
      tokens: {
        accessToken: long.access_token,
        expiresAt,
        scopes: IG_SCOPES,
        extra: { method: "instagram", igUserId },
      },
      account: {
        externalId: igUserId,
        handle: me.username ?? igUserId,
        displayName: me.username,
        avatarUrl: me.profile_picture_url,
      },
    };
  }

  /** Facebook-login: short → long user token, then find a Page with a linked IG account. */
  private async handleFacebookCallback(opts: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    const shortUrl = `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: fbClientId(),
      client_secret: fbClientSecret(),
      redirect_uri: opts.redirectUri,
      code: opts.code,
    })}`;
    const shortRes = await fetch(shortUrl);
    if (!shortRes.ok) {
      throw new Error(`Facebook token exchange failed (${shortRes.status}): ${await shortRes.text()}`);
    }
    const shortToken = ((await shortRes.json()) as FbUserTokenResponse).access_token;

    const longUrl = `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: fbClientId(),
      client_secret: fbClientSecret(),
      fb_exchange_token: shortToken,
    })}`;
    const longRes = await fetch(longUrl);
    if (!longRes.ok) {
      throw new Error(`Facebook long-lived exchange failed (${longRes.status}): ${await longRes.text()}`);
    }
    const longJson = (await longRes.json()) as FbUserTokenResponse;
    const userToken = longJson.access_token;
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
      : undefined;

    const { page, ig } = await this.firstPageWithInstagram(userToken);

    return {
      tokens: {
        // Publish via graph.facebook.com using the Page token.
        accessToken: page.access_token,
        expiresAt,
        scopes: FB_SCOPES,
        extra: { method: "facebook", igUserId: ig.id, pageId: page.id, userToken },
      },
      account: {
        externalId: ig.id,
        pageId: page.id,
        handle: ig.username ?? page.name,
        displayName: ig.username ?? page.name,
        avatarUrl: ig.profile_picture_url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (tokens.extra?.method === "facebook") {
      // Re-derive the Page token from the stashed long-lived user token.
      const userToken = tokens.extra?.userToken;
      const pageId = tokens.extra?.pageId;
      if (!userToken || !pageId) {
        throw new Error("No user token / pageId available to refresh Instagram (facebook) token");
      }
      const pages = await this.fetchPages(userToken);
      const page = pages.find((p) => p.id === pageId);
      if (!page) throw new Error(`Facebook Page ${pageId} not found (access may have been revoked)`);
      return { ...tokens, accessToken: page.access_token };
    }
    // Instagram-login: long-lived tokens are refreshed in place (must be >24h old, <60d).
    const url = `${IG_REFRESH_URL}?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: tokens.accessToken,
    })}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Instagram token refresh failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as IgLongTokenResponse;
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
      const igUserId = tokens.extra?.igUserId;
      if (!igUserId) throw new Error("Missing Instagram user id for publish");
      const token = tokens.accessToken;
      const base = tokens.extra?.method === "facebook" ? FB_GRAPH : IG_GRAPH;

      const media = input.media.slice(0, this.limits.mediaMax);
      let creationId: string;

      if (media.length > 1) {
        // Carousel: one child container per item, then a CAROUSEL container referencing them.
        const childIds: string[] = [];
        for (const m of media) {
          const childId = await this.createContainer(base, igUserId, token, {
            ...this.mediaParams(m, true),
            is_carousel_item: "true",
          });
          await this.waitForContainer(base, token, childId);
          childIds.push(childId);
        }
        creationId = await this.createContainer(base, igUserId, token, {
          media_type: "CAROUSEL",
          caption: input.caption,
          children: childIds.join(","),
        });
      } else {
        const m = media[0];
        if (!m) return { ok: false, error: "Instagram posts require at least one media item", retryable: false };
        creationId = await this.createContainer(base, igUserId, token, {
          ...this.mediaParams(m, false),
          caption: input.caption,
        });
      }

      // Videos/reels are processed asynchronously - wait for the container to be ready.
      await this.waitForContainer(base, token, creationId);

      const mediaId = await this.publishContainer(base, igUserId, token, creationId);
      const url = await this.permalink(base, token, mediaId);
      return { ok: true, externalPostId: mediaId, url };
    } catch (err) {
      const retryable = err instanceof IgHttpError ? err.retryable : true;
      return { ok: false, error: `Instagram publish error: ${(err as Error).message}`, retryable };
    }
  }

  /** Container params for a single post item or a carousel child. */
  private mediaParams(media: PublishMedia, carousel: boolean): Record<string, string> {
    if (media.kind === "video") {
      // Standalone videos publish as Reels; carousel video children use VIDEO.
      return carousel
        ? { media_type: "VIDEO", video_url: media.url }
        : { media_type: "REELS", video_url: media.url };
    }
    return { image_url: media.url };
  }

  private async createContainer(
    base: string,
    igUserId: string,
    token: string,
    fields: Record<string, string>,
  ): Promise<string> {
    const res = await fetch(`${base}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, access_token: token }),
    });
    if (!res.ok) {
      throw new IgHttpError(
        `Instagram media container failed (${res.status}): ${await res.text()}`,
        isRetryableStatus(res.status),
      );
    }
    return ((await res.json()) as { id: string }).id;
  }

  private async publishContainer(
    base: string,
    igUserId: string,
    token: string,
    creationId: string,
  ): Promise<string> {
    const res = await fetch(`${base}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    if (!res.ok) {
      throw new IgHttpError(
        `Instagram media_publish failed (${res.status}): ${await res.text()}`,
        isRetryableStatus(res.status),
      );
    }
    return ((await res.json()) as { id: string }).id;
  }

  /** Poll a container until it finishes processing (images are usually FINISHED immediately). */
  private async waitForContainer(
    base: string,
    token: string,
    creationId: string,
    maxAttempts = 20,
    delayMs = 3000,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(
        `${base}/${creationId}?${new URLSearchParams({ fields: "status_code", access_token: token })}`,
      );
      if (!res.ok) {
        throw new IgHttpError(
          `Instagram container status check failed (${res.status}): ${await res.text()}`,
          isRetryableStatus(res.status),
        );
      }
      const status = ((await res.json()) as { status_code?: string }).status_code;
      if (status === "FINISHED") return;
      if (status === "ERROR" || status === "EXPIRED") {
        throw new IgHttpError(`Instagram container ${status}`, false);
      }
      await sleep(delayMs);
    }
    throw new IgHttpError("Instagram container processing timed out", true);
  }

  /** Best-effort permalink for the published media; omitted if the lookup fails. */
  private async permalink(base: string, token: string, mediaId: string): Promise<string | undefined> {
    try {
      const res = await fetch(
        `${base}/${mediaId}?${new URLSearchParams({ fields: "permalink", access_token: token })}`,
      );
      if (!res.ok) return undefined;
      return ((await res.json()) as { permalink?: string }).permalink;
    } catch {
      return undefined;
    }
  }

  private async fetchInstagramProfile(accessToken: string): Promise<{
    user_id?: string;
    username?: string;
    profile_picture_url?: string;
  }> {
    const res = await fetch(
      `${IG_GRAPH}/me?${new URLSearchParams({
        fields: "user_id,username,profile_picture_url",
        access_token: accessToken,
      })}`,
    );
    if (!res.ok) {
      throw new Error(`Instagram profile lookup failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as {
      user_id?: string | number;
      username?: string;
      profile_picture_url?: string;
    };
    return {
      user_id: json.user_id != null ? String(json.user_id) : undefined,
      username: json.username,
      profile_picture_url: json.profile_picture_url,
    };
  }

  /** Return the first Page that has a linked Instagram business account; throws if none. */
  private async firstPageWithInstagram(userToken: string): Promise<{ page: FbPage; ig: IgBusinessAccount }> {
    const pages = await this.fetchPages(userToken);
    for (const page of pages) {
      if (page.instagram_business_account) {
        return { page, ig: page.instagram_business_account };
      }
    }
    throw new Error(
      "No Facebook Page with a linked Instagram business account was found (link an IG Business/Creator account to your Page)",
    );
  }

  private async fetchPages(userToken: string): Promise<FbPage[]> {
    const res = await fetch(
      `${FB_GRAPH}/me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
        access_token: userToken,
      })}`,
    );
    if (!res.ok) {
      throw new Error(`Facebook /me/accounts failed (${res.status}): ${await res.text()}`);
    }
    return ((await res.json()) as { data: FbPage[] }).data ?? [];
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`Instagram does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for Instagram`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for Instagram`);
    }
    if ((input.type === "image" || input.type === "video") && input.media.length === 0) {
      errors.push(`${input.type} posts require at least one media item`);
    }
    return { ok: errors.length === 0, errors };
  }
}

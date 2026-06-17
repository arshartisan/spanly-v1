/**
 * FacebookProvider - real Facebook Page integration (docs/implementation/02 + 06 + 09).
 *
 * OAuth 2.0 Authorization Code (no PKCE - Facebook is a confidential web app). The signed
 * CSRF `state` is echoed back and verified by the caller.
 *
 * Unlike X/LinkedIn (single user + single token), Meta publishes as a **Page**, not the
 * logged-in person. The flow is:
 *   1. code            → short-lived USER token
 *   2. fb_exchange_token → long-lived USER token (~60 days)
 *   3. GET /me/accounts  → the Pages the user manages, each with its own PAGE token
 * A Page token derived from a long-lived user token effectively does not expire, so we
 * publish with the Page token (stored as `tokens.accessToken`) and keep the long-lived user
 * token in `tokens.extra.userToken` so refresh() can re-derive a fresh Page token.
 *
 * The connected Page is the ExternalAccount (externalId/pageId = Page id). Page selection UI
 * (when a user manages several) is a follow-up - for now we take the first Page returned.
 *
 * Endpoints (vVERSION):
 *   authorize  https://www.facebook.com/<v>/dialog/oauth
 *   token      https://graph.facebook.com/<v>/oauth/access_token
 *   accounts   https://graph.facebook.com/<v>/me/accounts
 *   feed       https://graph.facebook.com/<v>/{page-id}/feed
 *   photos     https://graph.facebook.com/<v>/{page-id}/photos
 *   videos     https://graph.facebook.com/<v>/{page-id}/videos
 *
 * Requires (env): FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET. Optional FACEBOOK_VERSION
 * (defaults below). Scopes: public_profile pages_show_list pages_manage_posts
 * pages_read_engagement (the publish scopes require Meta app review for non-test users).
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

/** Graph API version. Bump via env as versions roll forward (~2yr support window each). */
const FACEBOOK_VERSION = process.env.FACEBOOK_VERSION ?? "v21.0";
const AUTHORIZE_URL = `https://www.facebook.com/${FACEBOOK_VERSION}/dialog/oauth`;
const GRAPH = `https://graph.facebook.com/${FACEBOOK_VERSION}`;

const SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
];

function clientId(): string {
  const id = process.env.FACEBOOK_CLIENT_ID;
  if (!id) throw new Error("FACEBOOK_CLIENT_ID is not set");
  return id;
}

function clientSecret(): string {
  const secret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!secret) throw new Error("FACEBOOK_CLIENT_SECRET is not set");
  return secret;
}

/** HTTP 429 / 5xx are transient; everything else (4xx) is a permanent failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface UserTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface Page {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
}

export class FacebookProvider implements PlatformProvider {
  readonly platform = "facebook" as const;
  readonly capabilities = PLATFORM_CONFIG.facebook.capabilities;
  readonly limits = PLATFORM_CONFIG.facebook.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId(),
      redirect_uri: opts.redirectUri,
      scope: SCOPES.join(","), // Facebook uses comma-separated scopes
      state: opts.state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
    state?: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    // 1. Exchange the code for a short-lived user token (Graph token endpoint is a GET).
    const shortUrl = `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: opts.redirectUri,
      code: opts.code,
    })}`;
    const shortRes = await fetch(shortUrl);
    if (!shortRes.ok) {
      throw new Error(`Facebook token exchange failed (${shortRes.status}): ${await shortRes.text()}`);
    }
    const shortToken = ((await shortRes.json()) as UserTokenResponse).access_token;

    // 2. Upgrade to a long-lived user token (~60 days).
    const longUrl = `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId(),
      client_secret: clientSecret(),
      fb_exchange_token: shortToken,
    })}`;
    const longRes = await fetch(longUrl);
    if (!longRes.ok) {
      throw new Error(`Facebook long-lived exchange failed (${longRes.status}): ${await longRes.text()}`);
    }
    const longJson = (await longRes.json()) as UserTokenResponse;
    const userToken = longJson.access_token;
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
      : undefined;

    // 3. Resolve the Pages this user manages and pick one (first for now).
    const page = await this.firstPage(userToken);

    return {
      tokens: {
        // We publish as the Page, so the Page token is the primary access token.
        accessToken: page.access_token,
        scopes: SCOPES,
        expiresAt,
        // Keep the long-lived user token so refresh() can re-derive the Page token.
        extra: { userToken, pageId: page.id },
      },
      account: {
        externalId: page.id,
        pageId: page.id,
        handle: page.name,
        displayName: page.name,
        avatarUrl: page.picture?.data?.url,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    // Page tokens from a long-lived user token don't expire on their own, but re-deriving
    // gives us a fresh one and surfaces revocation. Needs the stashed user token + pageId.
    const userToken = tokens.extra?.userToken;
    const pageId = tokens.extra?.pageId;
    if (!userToken || !pageId) {
      throw new Error("No user token / pageId available to refresh Facebook Page token");
    }
    const page = await this.findPage(userToken, pageId);
    return { ...tokens, accessToken: page.access_token };
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const pageId = tokens.extra?.pageId;
      if (!pageId) throw new Error("Missing pageId for Facebook publish");
      const pageToken = tokens.accessToken;

      const media = input.media.slice(0, this.limits.mediaMax);
      const hasVideo = media.some((m) => m.kind === "video");

      // Video → /videos (one per post). Photos → /photos. Otherwise a plain text /feed post.
      if (hasVideo) {
        return await this.publishVideo(pageId, pageToken, input, media);
      }
      if (media.length > 0) {
        return await this.publishPhotos(pageId, pageToken, input, media);
      }
      return await this.publishFeed(pageId, pageToken, { message: input.caption });
    } catch (err) {
      // Network/parse errors are worth a retry.
      return {
        ok: false,
        error: `Facebook publish error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  }

  /** A plain feed post; `extra` may carry attached_media for multi-photo posts. */
  private async publishFeed(
    pageId: string,
    pageToken: string,
    fields: Record<string, string>,
  ): Promise<PublishResult> {
    const res = await fetch(`${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, access_token: pageToken }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Facebook feed publish failed (${res.status}): ${await res.text()}`,
        retryable: isRetryableStatus(res.status),
      };
    }
    const id = ((await res.json()) as { id: string }).id;
    return { ok: true, externalPostId: id, url: `https://www.facebook.com/${id}` };
  }

  private async publishPhotos(
    pageId: string,
    pageToken: string,
    input: PublishInput,
    media: PublishMedia[],
  ): Promise<PublishResult> {
    // Single image: publish directly with a caption.
    if (media.length === 1) {
      const res = await fetch(`${GRAPH}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: media[0].url,
          caption: input.caption,
          access_token: pageToken,
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `Facebook photo publish failed (${res.status}): ${await res.text()}`,
          retryable: isRetryableStatus(res.status),
        };
      }
      const json = (await res.json()) as { post_id?: string; id: string };
      const id = json.post_id ?? json.id;
      return { ok: true, externalPostId: id, url: `https://www.facebook.com/${id}` };
    }

    // Multiple images: upload each unpublished, then attach to one feed post.
    const attached: Record<string, string> = {};
    for (let i = 0; i < media.length; i++) {
      const mediaFbid = await this.uploadUnpublishedPhoto(pageId, pageToken, media[i]);
      attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: mediaFbid });
    }
    return this.publishFeed(pageId, pageToken, { message: input.caption, ...attached });
  }

  /** Upload a photo without publishing it; returns its media_fbid for attaching to a post. */
  private async uploadUnpublishedPhoto(
    pageId: string,
    pageToken: string,
    media: PublishMedia,
  ): Promise<string> {
    const res = await fetch(`${GRAPH}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        url: media.url,
        published: "false",
        access_token: pageToken,
      }),
    });
    if (!res.ok) {
      throw new Error(`unpublished photo upload failed (${res.status}): ${await res.text()}`);
    }
    return ((await res.json()) as { id: string }).id;
  }

  private async publishVideo(
    pageId: string,
    pageToken: string,
    input: PublishInput,
    media: PublishMedia[],
  ): Promise<PublishResult> {
    const video = media.find((m) => m.kind === "video");
    if (!video) throw new Error("publishVideo called without a video item");
    // Graph accepts a remote file_url and ingests it server-side (no chunked upload needed).
    const res = await fetch(`${GRAPH}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        file_url: video.url,
        description: input.caption,
        access_token: pageToken,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Facebook video publish failed (${res.status}): ${await res.text()}`,
        retryable: isRetryableStatus(res.status),
      };
    }
    const id = ((await res.json()) as { id: string }).id;
    return { ok: true, externalPostId: id, url: `https://www.facebook.com/${id}` };
  }

  /** Fetch the user's managed Pages and return the first; throws if none. */
  private async firstPage(userToken: string): Promise<Page> {
    const pages = await this.fetchPages(userToken);
    if (pages.length === 0) {
      throw new Error("No Facebook Pages found for this user (pages_show_list required)");
    }
    return pages[0];
  }

  private async findPage(userToken: string, pageId: string): Promise<Page> {
    const pages = await this.fetchPages(userToken);
    const page = pages.find((p) => p.id === pageId);
    if (!page) throw new Error(`Facebook Page ${pageId} not found (access may have been revoked)`);
    return page;
  }

  private async fetchPages(userToken: string): Promise<Page[]> {
    const res = await fetch(
      `${GRAPH}/me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,picture",
        access_token: userToken,
      })}`,
    );
    if (!res.ok) {
      throw new Error(`Facebook /me/accounts failed (${res.status}): ${await res.text()}`);
    }
    return ((await res.json()) as { data: Page[] }).data ?? [];
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`Facebook does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for Facebook`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for Facebook`);
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

/**
 * LinkedinProvider - real LinkedIn integration (docs/implementation/02 + 06 + 09).
 *
 * OAuth 2.0 Authorization Code (no PKCE - LinkedIn is a confidential web app and does not
 * support/require PKCE). The signed CSRF `state` is echoed back and verified by the caller.
 *
 * Endpoints:
 *   authorize  https://www.linkedin.com/oauth/v2/authorization
 *   token      https://www.linkedin.com/oauth/v2/accessToken
 *   userinfo   https://api.linkedin.com/v2/userinfo            (OpenID Connect)
 *   posts      https://api.linkedin.com/rest/posts             (versioned REST)
 *   images     https://api.linkedin.com/rest/images?action=initializeUpload
 *
 * Requires (env): LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET. Optional LINKEDIN_VERSION
 * (YYYYMM; defaults below). Scopes requested: openid profile email w_member_social.
 *
 * Author URN: the OpenID `sub` claim → `urn:li:person:{sub}`. We stash `sub` in
 * tokens.extra so publish() can build the author without re-calling userinfo.
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

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGES_URL = "https://api.linkedin.com/rest/images";

const SCOPES = ["openid", "profile", "email", "w_member_social"];

/**
 * LinkedIn requires a monthly API version (YYYYMM) and only keeps each one active for ~12
 * months, so this must be a recent, still-active version. Override via env as it rolls forward
 * (a 426 NONEXISTENT_VERSION error means this value has aged out - bump it).
 */
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION ?? "202601";

function clientId(): string {
  const id = process.env.LINKEDIN_CLIENT_ID;
  if (!id) throw new Error("LINKEDIN_CLIENT_ID is not set");
  return id;
}

function clientSecret(): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret) throw new Error("LINKEDIN_CLIENT_SECRET is not set");
  return secret;
}

/** Headers required by every versioned REST call (posts, images). */
function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
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
    // LinkedIn only issues refresh tokens to approved apps; keep the previous one otherwise.
    refreshToken: json.refresh_token ?? prev?.refreshToken,
    expiresAt,
    scopes: json.scope ? json.scope.split(" ") : (prev?.scopes ?? SCOPES),
    extra: prev?.extra,
  };
}

interface UserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
}

export class LinkedinProvider implements PlatformProvider {
  readonly platform = "linkedin" as const;
  readonly capabilities = PLATFORM_CONFIG.linkedin.capabilities;
  readonly limits = PLATFORM_CONFIG.linkedin.limits;

  getAuthUrl(opts: AuthUrlOptions): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId(),
      redirect_uri: opts.redirectUri,
      scope: SCOPES.join(" "),
      state: opts.state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(opts: {
    code: string;
    redirectUri: string;
    state?: string;
  }): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
    }
    const tokens = tokensFrom((await res.json()) as TokenResponse);

    // Identify the connected member.
    const me = await this.fetchUserInfo(tokens.accessToken);

    // Stash the OpenID subject so publish() can build the author URN statelessly.
    tokens.extra = { ...(tokens.extra ?? {}), sub: me.sub };

    return {
      tokens,
      account: {
        externalId: me.sub,
        handle: me.name ?? me.sub,
        displayName: me.name,
        avatarUrl: me.picture,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for LinkedIn account");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`LinkedIn token refresh failed (${res.status}): ${await res.text()}`);
    }
    return tokensFrom((await res.json()) as TokenResponse, tokens);
  }

  async publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult> {
    try {
      const author = await this.authorUrn(tokens);

      // Upload media first; each returns an `urn:li:image:...` reference.
      const imageUrns: string[] = [];
      for (const m of input.media.slice(0, this.limits.mediaMax)) {
        imageUrns.push(await this.uploadImage(m, tokens.accessToken, author));
      }

      const payload: Record<string, unknown> = {
        author,
        commentary: input.caption,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };
      if (imageUrns.length === 1) {
        payload.content = { media: { id: imageUrns[0] } };
      } else if (imageUrns.length > 1) {
        payload.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };
      }

      const res = await fetch(POSTS_URL, {
        method: "POST",
        headers: { ...restHeaders(tokens.accessToken), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          ok: false,
          error: `LinkedIn publish failed (${res.status}): ${await res.text()}`,
          retryable: isRetryableStatus(res.status),
        };
      }

      // The created post URN comes back in the x-restli-id response header.
      const urn = res.headers.get("x-restli-id") ?? "";
      const url = urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined;
      return { ok: true, externalPostId: urn || "linkedin-post", url };
    } catch (err) {
      // Network/parse errors are worth a retry.
      return {
        ok: false,
        error: `LinkedIn publish error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  }

  /** Resolve the author URN, preferring the stashed `sub` and falling back to userinfo. */
  private async authorUrn(tokens: ProviderTokens): Promise<string> {
    const sub = tokens.extra?.sub ?? (await this.fetchUserInfo(tokens.accessToken)).sub;
    return `urn:li:person:${sub}`;
  }

  private async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`LinkedIn userinfo failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as UserInfo;
  }

  /**
   * Upload one image: initializeUpload → PUT the bytes to the returned uploadUrl →
   * return the `urn:li:image:...` to reference in the post.
   */
  private async uploadImage(
    media: PublishMedia,
    accessToken: string,
    ownerUrn: string,
  ): Promise<string> {
    if (media.kind !== "image") {
      throw new Error(`LinkedIn live publishing supports image media only (got ${media.kind})`);
    }

    // INIT
    const initRes = await fetch(`${IMAGES_URL}?action=initializeUpload`, {
      method: "POST",
      headers: { ...restHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    });
    if (!initRes.ok) {
      throw new Error(`image initializeUpload failed (${initRes.status}): ${await initRes.text()}`);
    }
    const init = (await initRes.json()) as { value: { uploadUrl: string; image: string } };

    // Fetch the bytes from our media URL.
    const fileRes = await fetch(media.url);
    if (!fileRes.ok) throw new Error(`Could not fetch media (${fileRes.status}): ${media.url}`);
    const contentType = fileRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await fileRes.arrayBuffer());

    // PUT the raw bytes to the upload URL (still bearer-authenticated).
    const putRes = await fetch(init.value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
      body: bytes,
    });
    if (!putRes.ok) {
      throw new Error(`image upload PUT failed (${putRes.status}): ${await putRes.text()}`);
    }

    return init.value.image;
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`LinkedIn does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for LinkedIn`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for LinkedIn`);
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

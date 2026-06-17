import "server-only";

/**
 * Google OAuth 2.0 helper for USER SIGN-IN (not YouTube publishing — that uses the separate
 * GOOGLE_CLIENT_ID/SECRET via the provider registry). Plain `fetch`, no SDK, matching the
 * repo's provider style. Credentials come from a dedicated OAuth client so sign-in scopes and
 * redirect URIs stay isolated from publishing.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// OpenID Connect userinfo endpoint (works with the `openid email profile` scopes).
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleProfile {
  sub: string; // stable Google account id
  email: string; // normalized to lowercase
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

function clientId(): string {
  const id = process.env.GOOGLE_AUTH_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_AUTH_CLIENT_ID is required for Google sign-in.");
  return id;
}

function clientSecret(): string {
  const s = process.env.GOOGLE_AUTH_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_AUTH_CLIENT_SECRET is required for Google sign-in.");
  return s;
}

/** Build the Google consent URL to 302 the user to. */
export function googleAuthUrl(opts: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchange the authorization code for tokens, then fetch the user's profile. */
export async function exchangeGoogleCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google token response missing access_token.");

  const infoRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) {
    throw new Error(`Google userinfo failed (${infoRes.status}): ${await infoRes.text()}`);
  }
  const info = (await infoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  };
  if (!info.sub || !info.email) throw new Error("Google profile missing sub/email.");

  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    // userinfo returns a boolean; id_token payloads sometimes stringify it — accept both.
    emailVerified: info.email_verified === true || info.email_verified === "true",
    name: info.name ?? null,
    picture: info.picture ?? null,
  };
}

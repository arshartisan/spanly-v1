import { NextResponse } from "next/server";
import { signAuthState } from "@/server/auth-oauth-state";
import { googleAuthUrl } from "@/server/google-auth";
import { publicOrigin } from "@/server/public-url";

// GET /api/auth/google/start - begin Google sign-in / sign-up.
// Mirrors the connect start flow: sign a short-lived CSRF state (carrying the post-login
// `next` deep-link) and 302 to Google's consent screen.
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const nextParam = new URL(req.url).searchParams.get("next");
  // Only honor app-relative paths (block open redirects / protocol-relative URLs).
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : undefined;

  const state = signAuthState({ next });
  const redirectUri = `${origin}/api/auth/google/callback`;
  return NextResponse.redirect(new URL(googleAuthUrl({ state, redirectUri }), origin));
}

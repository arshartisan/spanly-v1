import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { createSession, createTrialUser } from "@/server/auth";
import { verifyAuthState } from "@/server/auth-oauth-state";
import { exchangeGoogleCode } from "@/server/google-auth";
import { publicOrigin } from "@/server/public-url";
import { isEnabled } from "@/server/settings/flags";

// GET /api/auth/google/callback — finish Google sign-in.
// Verify the CSRF state, exchange the code for the user's profile, then resolve the user by
// linking (existing email), signing in (existing Google id), or creating a new trial account.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const toLogin = (q: string) => NextResponse.redirect(new URL(`/login?${q}`, origin));

  // User declined consent at Google (or hit Google's own error path).
  if (url.searchParams.get("error")) return toLogin("error=oauth_cancelled");

  const state = verifyAuthState(url.searchParams.get("state"));
  if (!state) return toLogin("error=oauth");

  const code = url.searchParams.get("code");
  if (!code) return toLogin("error=oauth");

  const redirectUri = `${origin}/api/auth/google/callback`;
  let profile;
  try {
    profile = await exchangeGoogleCode({ code, redirectUri });
  } catch (err) {
    console.error("[auth:google] code exchange failed:", err);
    return toLogin("error=oauth");
  }

  // Only trust Google-verified emails — auto-linking by email depends on this.
  if (!profile.emailVerified) return toLogin("error=oauth_unverified");

  // Resolve (link / create / sign-in) + create the session. Any DB/session failure here lands
  // on a friendly /login error rather than a bare 500.
  try {
    // 1) Returning Google user, matched by their stable Google id.
    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });

    // 2) Auto-link: an existing account with the same (verified) email adopts the Google id.
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.sub,
            emailVerified: byEmail.emailVerified ?? new Date(),
            avatarUrl: byEmail.avatarUrl ?? profile.picture,
          },
        });
      }
    }

    // 3) Brand-new user → create with the standard onboarding defaults. Honors the signups
    //    kill-switch exactly like the email signup route.
    if (!user) {
      if (!(await isEnabled("signups"))) {
        return NextResponse.redirect(new URL("/signup?error=signups_disabled", origin));
      }
      user = await createTrialUser({
        email: profile.email,
        displayName: profile.name,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        emailVerified: new Date(),
      });
    }

    // Suspended accounts authenticate but are denied a session (doc 16), same as login.
    if (user.suspendedAt) return toLogin("error=suspended");

    await createSession(user.id);

    // Honor a validated deep-link, else the role-based target (staff → /admin), same as login.
    const next =
      state.next && state.next.startsWith("/") && !state.next.startsWith("//") ? state.next : null;
    const target = next ?? (user.role === "user" ? "/dashboard" : "/admin");
    return NextResponse.redirect(new URL(target, origin));
  } catch (err) {
    console.error("[auth:google] sign-in resolution failed:", err);
    return toLogin("error=oauth");
  }
}

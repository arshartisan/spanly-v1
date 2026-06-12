import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { canConnect } from "@/server/connections";
import { signState } from "@/server/oauth-state";
import { getProvider } from "@/providers/registry";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

// GET /api/connect/[platform]/start (docs/implementation/05 + 14)
// Require session, enforce the plan account-limit, then 302 to the provider auth URL
// (the internal mock consent page in MVP) carrying a signed CSRF state.
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const origin = new URL(req.url).origin;

  if (!PLATFORMS.includes(platform as PlatformKey)) {
    return NextResponse.redirect(new URL("/connections?error=unknown", origin));
  }
  const key = platform as PlatformKey;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/connections`, origin));
  }

  const methodParam = new URL(req.url).searchParams.get("method");
  const method = methodParam === "facebook" || methodParam === "instagram" ? methodParam : undefined;

  const plan = user.subscription?.plan ?? "creator";
  const gate = await canConnect(user.id, plan, key);
  if (!gate.ok) {
    return NextResponse.redirect(new URL("/connections?error=limit", origin));
  }

  const state = signState({ userId: user.id, platform: key, method });
  const redirectUri = `${origin}/api/connect/${key}/callback`;
  const authUrl = getProvider(key).getAuthUrl({ state, redirectUri, method });

  return NextResponse.redirect(new URL(authUrl, origin));
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { encryptTokens } from "@/server/crypto";
import { verifyState } from "@/server/oauth-state";
import { getProvider } from "@/providers/registry";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { IgConnectMethod } from "@prisma/client";

// GET /api/connect/[platform]/callback (docs/implementation/05 + 14)
// Verify CSRF state, exchange the code via the provider, then upsert an encrypted
// SocialAccount. Reconnecting the same external account refreshes it in place.
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/connections?${q}`, origin));

  if (!PLATFORMS.includes(platform as PlatformKey)) return back("error=unknown");
  const key = platform as PlatformKey;

  // User declined consent (or our mock Cancel).
  if (url.searchParams.get("error")) return back("error=cancelled");

  const state = verifyState(url.searchParams.get("state"));
  if (!state || state.platform !== key) return back("error=state");

  const code = url.searchParams.get("code");
  if (!code) return back("error=cancelled");

  const provider = getProvider(key);
  const redirectUri = `${origin}/api/connect/${key}/callback`;

  let tokens, account;
  try {
    ({ tokens, account } = await provider.handleCallback({ code, redirectUri }));
  } catch {
    return back("error=callback");
  }

  const igConnectMethod: IgConnectMethod | null =
    key === "instagram" ? (state.method ?? "instagram") : null;
  const pageId =
    account.pageId ?? (key === "instagram" && state.method === "facebook" ? "mock-page-1" : null);

  const fields = {
    handle: account.handle,
    displayName: account.displayName ?? null,
    avatarUrl: account.avatarUrl ?? null,
    pageId,
    igConnectMethod,
    status: "active" as const,
    capabilities: [...provider.capabilities],
    scopes: tokens.scopes,
    encryptedTokens: encryptTokens(tokens),
    tokenExpiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
    disconnectedAt: null,
  };

  await prisma.socialAccount.upsert({
    where: {
      userId_platform_externalId: {
        userId: state.userId,
        platform: key,
        externalId: account.externalId,
      },
    },
    create: { userId: state.userId, platform: key, externalId: account.externalId, ...fields },
    update: fields,
  });

  return back(`connected=${key}`);
}

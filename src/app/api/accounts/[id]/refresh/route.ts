import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { decryptTokens, encryptTokens } from "@/server/crypto";
import { getProvider } from "@/providers/registry";

// POST /api/accounts/[id]/refresh (docs/implementation/05)
// Re-mint the access token via the provider, re-encrypt, and clear expired/error status.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const account = await prisma.socialAccount.findFirst({
    where: { id, userId: user.id, disconnectedAt: null },
  });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  try {
    const current = decryptTokens(account.encryptedTokens);
    const refreshed = await getProvider(account.platform).refresh(current);
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        encryptedTokens: encryptTokens(refreshed),
        scopes: refreshed.scopes,
        tokenExpiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
        status: "active",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not refresh this connection." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

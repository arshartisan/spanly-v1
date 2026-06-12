import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

// DELETE /api/accounts/[id] (docs/implementation/05)
// Soft-delete (D-010): mark disconnectedAt + status=error so PostTarget history survives.
// The account disappears from /connections and the composer (both filter disconnectedAt:null).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const account = await prisma.socialAccount.findFirst({
    where: { id, userId: user.id, disconnectedAt: null },
  });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: { disconnectedAt: new Date(), status: "error" },
  });

  return NextResponse.json({ ok: true });
}

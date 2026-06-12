import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { getCurrentUser, hashPassword, verifyPassword } from "@/server/auth";
import { SESSION_COOKIE } from "@/server/auth";
import { cookies } from "next/headers";

// POST /api/auth/change-password — change password from the Security/Password card (doc 11A).
// Requires the current password; invalidates all OTHER sessions but keeps this one signed in.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 422 });

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const currentToken = (await cookies()).get(SESSION_COOKIE)?.value;

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Sign out every other device; keep the current session valid.
    prisma.session.deleteMany({
      where: { userId: user.id, NOT: { sessionToken: currentToken ?? "" } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

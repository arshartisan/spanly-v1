import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { resetSchema } from "@/lib/schemas/auth";
import { consumeToken, hashPassword } from "@/server/auth";

export async function POST(req: Request) {
  const parsed = resetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const userId = await consumeToken(token, "reset_password");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  // Set the new password AND invalidate all existing sessions (doc 03): a reset
  // logs the user out everywhere, forcing re-login with the new password.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { changeEmailSchema } from "@/lib/schemas/auth";
import { getCurrentUser, issueToken, verifyPassword } from "@/server/auth";
import { mailer } from "@/server/mailer";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

// POST /api/auth/change-email — change email from the Email card (doc 11A). Requires the
// password; sets the new email unverified and sends a re-verification link (D-013 mailer).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = changeEmailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 422 });

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Password is incorrect." }, { status: 403 });

  const email = parsed.data.email.trim().toLowerCase();
  if (email === user.email) {
    return NextResponse.json({ error: "That's already your email." }, { status: 409 });
  }
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });

  await prisma.user.update({
    where: { id: user.id },
    data: { email, emailVerified: null },
  });

  const token = await issueToken(user.id, "verify_email", VERIFY_TTL_MS);
  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/verify?token=${token}`;
  await mailer.send({
    to: email,
    subject: "Confirm your new Spanly email",
    text: "Confirm this address to finish changing your Spanly email.",
    actionUrl: verifyUrl,
  });

  return NextResponse.json({ ok: true });
}

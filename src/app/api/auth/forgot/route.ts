import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { forgotSchema } from "@/lib/schemas/auth";
import { issueToken } from "@/server/auth";
import { mailer } from "@/server/mailer";
import { clientIp, rateLimit } from "@/server/rate-limit";

const RESET_TTL_MS = 60 * 60 * 1000; // 1h (doc 03)

export async function POST(req: Request) {
  const rl = await rateLimit(`forgot:${clientIp(req)}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const parsed = forgotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Only send when the user exists, but ALWAYS respond 200 (don't leak which
  // emails are registered — doc 03).
  if (user) {
    const token = await issueToken(user.id, "reset_password", RESET_TTL_MS);
    const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset?token=${token}`;
    await mailer.send({
      to: user.email,
      subject: "Reset your Spanly password",
      text: "Use the link below to set a new password. It expires in 1 hour.",
      actionUrl: resetUrl,
    });
  }

  return NextResponse.json({ ok: true });
}

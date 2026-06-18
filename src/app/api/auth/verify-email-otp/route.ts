import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { emailOtpVerifySchema } from "@/lib/schemas/auth";
import { verifyLoginOtp } from "@/server/login-otp";
import { clientIp, rateLimit } from "@/server/rate-limit";

// POST /api/auth/verify-email-otp - confirm the signed-in user's email with the 6-digit code from
// /api/auth/send-email-otp. On success sets emailVerified.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rl = await rateLimit(`verify-email-otp:${user.id}:${clientIp(req)}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  if (user.emailVerified) return NextResponse.json({ ok: true });

  const parsed = emailOtpVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const result = await verifyLoginOtp(user.id, parsed.data.code, "verify_email");
  if (result !== "ok") {
    const message =
      result === "expired"
        ? "That code expired. Request a new one."
        : result === "too_many_attempts"
          ? "Too many incorrect attempts. Request a new code."
          : "Invalid or expired code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return NextResponse.json({ ok: true });
}

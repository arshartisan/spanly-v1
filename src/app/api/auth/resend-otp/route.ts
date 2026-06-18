import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { resendOtpSchema } from "@/lib/schemas/auth";
import { dummyVerify, verifyPassword } from "@/server/auth";
import { issueLoginOtp, OTP_TTL_MINUTES } from "@/server/login-otp";
import { sendLoginOtpEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

// POST /api/auth/resend-otp - re-issue a login code. Re-checks the password (so this can't be used
// to spam codes at arbitrary accounts) and always responds 200 to avoid enumeration.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`resend-otp:${ip}`, 3, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
  }

  const parsed = resendOtpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    await dummyVerify(password);
    return NextResponse.json({ ok: true });
  }
  if (!(await verifyPassword(password, user.passwordHash)) || user.suspendedAt) {
    return NextResponse.json({ ok: true });
  }

  const code = await issueLoginOtp(user.id);
  await sendLoginOtpEmail(user.email, { code, minutes: OTP_TTL_MINUTES, displayName: user.displayName, ip });
  return NextResponse.json({ ok: true });
}

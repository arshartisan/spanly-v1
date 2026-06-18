import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/schemas/auth";
import { createSession, dummyVerify, verifyPassword } from "@/server/auth";
import { isTrustedDevice, issueLoginOtp, OTP_TTL_MINUTES } from "@/server/login-otp";
import { sendLoginOtpEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`login:${ip}`, 5, 60); // 5/min/IP (doc 03)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    // No user, or an OAuth-only account with no password set: keep timing constant (avoid
    // enumeration) and refuse with the same generic error so Google-only accounts can't be probed.
    await dummyVerify(password);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Suspended accounts authenticate but are denied a session (doc 16).
  if (user.suspendedAt) {
    return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });
  }

  // New-device step-up (D-013): recognized devices sign in immediately; an unknown device must
  // clear an emailed 6-digit code via /api/auth/verify-otp before a session is created.
  if (!(await isTrustedDevice(user.id))) {
    const code = await issueLoginOtp(user.id);
    await sendLoginOtpEmail(user.email, {
      code,
      minutes: OTP_TTL_MINUTES,
      displayName: user.displayName,
      ip,
    });
    return NextResponse.json({ otpRequired: true });
  }

  await createSession(user.id);
  // Staff (support/admin/superadmin) land on the admin dashboard; customers on the app (doc 15).
  const redirect = user.role === "user" ? "/dashboard" : "/admin";
  return NextResponse.json({ ok: true, redirect });
}

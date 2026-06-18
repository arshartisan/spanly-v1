import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { verifyOtpSchema } from "@/lib/schemas/auth";
import { createSession } from "@/server/auth";
import { trustCurrentDevice, verifyLoginOtp } from "@/server/login-otp";
import { clientIp, rateLimit } from "@/server/rate-limit";

// POST /api/auth/verify-otp - second step of new-device login. Verifies the 6-digit code, then
// (on success) creates the session and trusts this device for 30 days so it skips OTP next time.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`verify-otp:${ip}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const parsed = verifyOtpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }
  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Generic failure for any non-success path (no user enumeration, no leaking code state).
  if (!user || user.suspendedAt) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const result = await verifyLoginOtp(user.id, code);
  if (result !== "ok") {
    const message =
      result === "expired"
        ? "That code expired. Request a new one."
        : result === "too_many_attempts"
          ? "Too many incorrect attempts. Request a new code."
          : "Invalid or expired code.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  await trustCurrentDevice(user.id, { userAgent: req.headers.get("user-agent"), ip });
  await createSession(user.id);
  const redirect = user.role === "user" ? "/dashboard" : "/admin";
  return NextResponse.json({ ok: true, redirect });
}

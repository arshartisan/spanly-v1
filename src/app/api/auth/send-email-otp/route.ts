import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { issueLoginOtp, OTP_TTL_MINUTES } from "@/server/login-otp";
import { sendEmailVerificationOtp } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

// POST /api/auth/send-email-otp - email a 6-digit code to the signed-in user's address so they
// can confirm it from the settings page. No-op (still 200) if already verified.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rl = await rateLimit(`email-otp:${user.id}:${clientIp(req)}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
  }

  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const code = await issueLoginOtp(user.id, "verify_email");
  try {
    await sendEmailVerificationOtp(user.email, {
      code,
      minutes: OTP_TTL_MINUTES,
      displayName: user.displayName,
    });
  } catch (err) {
    // SMTP misconfig / outage: surface a clean error instead of a hung 502. The code is already
    // issued, so a retry (resend) will re-send without re-minting unnecessarily.
    console.error("send-email-otp: email send failed:", err);
    return NextResponse.json(
      { error: "We couldn't send the email right now. Please try again shortly." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { signupSchema } from "@/lib/schemas/auth";
import { createSession, createTrialUser, hashPassword, issueToken } from "@/server/auth";
import { sendVerificationEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { isEnabled } from "@/server/settings/flags";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(req: Request) {
  const rl = await rateLimit(`signup:${clientIp(req)}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  // Kill switch (doc 20): an admin can pause sign-ups without a deploy. Absent flag → enabled.
  if (!(await isEnabled("signups"))) {
    return NextResponse.json({ error: "Sign-ups are temporarily disabled." }, { status: 403 });
  }

  // Waitlist mode (doc 20): the public site is a waitlist - new accounts are paused. Existing
  // users keep logging in (that path is untouched). Absent flag → not in waitlist mode.
  if (await isEnabled("waitlist-mode")) {
    return NextResponse.json(
      { error: "Sign-ups are paused. Join the waitlist." },
      { status: 403 },
    );
  }

  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createTrialUser({ email: normalizedEmail, passwordHash, displayName });

  // Email verification link (D-013: dev mailer logs it to the console).
  const token = await issueToken(user.id, "verify_email", VERIFY_TTL_MS);
  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/verify?token=${token}`;
  await sendVerificationEmail(normalizedEmail, verifyUrl, displayName);

  // Email-unverified users may still browse in MVP (doc 03).
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

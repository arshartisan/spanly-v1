import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { signupSchema } from "@/lib/schemas/auth";
import { createSession, hashPassword, issueToken } from "@/server/auth";
import { mailer } from "@/server/mailer";
import { clientIp, rateLimit } from "@/server/rate-limit";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TRIAL_DAYS = 7;

export async function POST(req: Request) {
  const rl = await rateLimit(`signup:${clientIp(req)}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
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
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      displayName,
      subscription: {
        create: { plan: "creator", interval: "month", status: "trialing", trialEndsAt },
      },
      queueSettings: {
        create: {
          slots: {
            create: [
              { time: "11:00", days: [true, true, true, true, true, false, false] },
              { time: "16:00", days: [true, true, true, true, true, false, false] },
            ],
          },
        },
      },
    },
  });

  // Email verification link (D-013: dev mailer logs it to the console).
  const token = await issueToken(user.id, "verify_email", VERIFY_TTL_MS);
  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/verify?token=${token}`;
  await mailer.send({
    to: normalizedEmail,
    subject: "Confirm your Spanly email",
    text: `Welcome to Spanly! Confirm your email to finish setting up your account.`,
    actionUrl: verifyUrl,
  });

  // Email-unverified users may still browse in MVP (doc 03).
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

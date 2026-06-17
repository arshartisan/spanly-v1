import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/schemas/auth";
import { createSession, dummyVerify, verifyPassword } from "@/server/auth";
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
  if (!user) {
    // Compare against a dummy hash to keep timing constant (avoid enumeration).
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

  await createSession(user.id);
  // Staff (support/admin/superadmin) land on the admin dashboard; customers on the app (doc 15).
  const redirect = user.role === "user" ? "/dashboard" : "/admin";
  return NextResponse.json({ ok: true, redirect });
}

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

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authorizeApiRequest } from "@/server/api-keys";

// GET /api/v1/me — whoami for the authenticated API key (doc 12 public API).
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.subscription?.plan ?? null,
  });
}

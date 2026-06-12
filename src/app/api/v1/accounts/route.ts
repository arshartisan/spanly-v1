import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authorizeApiRequest } from "@/server/api-keys";

// GET /api/v1/accounts — the caller's connected (active) accounts (doc 12 public API).
export async function GET(req: Request) {
  const auth = await authorizeApiRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: auth.userId, disconnectedAt: null, status: "active" },
    orderBy: { connectedAt: "asc" },
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      displayName: a.displayName,
      capabilities: a.capabilities,
    })),
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

// Foundation health check (docs/implementation/00): verifies DB + Redis connectivity.
export async function GET() {
  const result: { db: string; redis: string; providerMode: string } = {
    db: "unknown",
    redis: "unknown",
    providerMode: process.env.PROVIDER_MODE ?? "mock",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db = "ok";
  } catch {
    result.db = "error";
  }

  try {
    const pong = await redis.ping();
    result.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    result.redis = "error";
  }

  const healthy = result.db === "ok" && result.redis === "ok";
  return NextResponse.json(result, { status: healthy ? 200 : 503 });
}

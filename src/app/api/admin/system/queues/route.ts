import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { getQueueCounts } from "@/server/admin/ops";

export const dynamic = "force-dynamic";

// GET /api/admin/system/queues — per-queue job counts (doc 19). Role: support.
// Redis-down degrades to null counts + redisOk:false, never a 500.
export async function GET() {
  try {
    await requireRole("support");
    const result = await getQueueCounts();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { getSystemHealth } from "@/server/admin/ops";

export const dynamic = "force-dynamic";

// GET /api/admin/system/health — DB/Redis/provider/billing health (doc 19). Role: support.
export async function GET() {
  try {
    await requireRole("support");
    const health = await getSystemHealth();
    return NextResponse.json(health, { status: health.healthy ? 200 : 503 });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

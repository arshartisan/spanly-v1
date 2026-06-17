import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listConnections } from "@/server/admin/content";
import { connectionListQuerySchema } from "@/lib/schemas/admin-content";

// GET /api/admin/connections - all social accounts across users with filters (doc 18). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = connectionListQuerySchema.safeParse({
      platform: url.searchParams.get("platform") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      tokenHealth: url.searchParams.get("tokenHealth") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const connections = await listConnections(parsed.data);
    return NextResponse.json({ connections });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

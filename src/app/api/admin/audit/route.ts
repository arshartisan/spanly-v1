import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listAuditLogs } from "@/server/admin/audit-log";
import { auditLogQuerySchema } from "@/lib/schemas/admin-audit";

// GET /api/admin/audit — append-only admin audit trail with filters + cursor paging (doc 15).
// Role: support. READ-ONLY: the log is never edited or deleted through the API.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await listAuditLogs(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { AdminActionError, listJobs } from "@/server/admin/ops";
import { jobListQuerySchema } from "@/lib/schemas/admin-ops";

export const dynamic = "force-dynamic";

// GET /api/admin/system/jobs?queue=&state=failed - failed/active job list (doc 19). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = jobListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await listJobs(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, retryJob } from "@/server/admin/ops";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/system/jobs/:queue/:jobId/retry - re-enqueue a failed job (doc 19). Role: admin.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ queue: string; jobId: string }> },
) {
  try {
    const actor = await requireRole("admin");
    const { queue, jobId } = await params;

    const result = await retryJob(queue, jobId);
    await logAdminAction({
      actorId: actor.id,
      action: "job.retry",
      targetType: "job",
      targetId: jobId,
      metadata: { queue },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, runMaintenance } from "@/server/admin/ops";
import { maintenanceTaskSchema } from "@/lib/schemas/admin-ops";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/system/maintenance/:task — enqueue a one-off sweep (doc 19). Role: admin.
export async function POST(req: Request, { params }: { params: Promise<{ task: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { task } = await params;

    const parsed = maintenanceTaskSchema.safeParse(task);
    if (!parsed.success) {
      return NextResponse.json({ error: "Unknown maintenance task." }, { status: 400 });
    }

    const result = await runMaintenance(parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "maintenance.run",
      targetType: "maintenance",
      targetId: parsed.data,
      metadata: { task: parsed.data },
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

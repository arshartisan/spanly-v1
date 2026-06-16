import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, startImpersonation } from "@/server/admin/support";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/impersonate — start impersonating a user (doc 21). Role: superadmin.
// On success the session cookie is swapped to the target; the client navigates to /dashboard.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("superadmin");
    const { id } = await params;

    await startImpersonation(actor, id);
    await logAdminAction({
      actorId: actor.id,
      action: "user.impersonate.start",
      targetType: "user",
      targetId: id,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

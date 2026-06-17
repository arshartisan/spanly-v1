import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, signOutAllFor } from "@/server/admin/users";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/signout-all - delete the target's sessions (doc 16). Role: support.
// Uses an admin-safe delete that never touches the acting admin's own cookie.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("support");
    const { id } = await params;

    const result = await signOutAllFor(id);
    await logAdminAction({
      actorId: actor.id,
      action: "user.signout_all",
      targetType: "user",
      targetId: id,
      metadata: { sessionsRevoked: result.sessionsRevoked },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, sessionsRevoked: result.sessionsRevoked });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

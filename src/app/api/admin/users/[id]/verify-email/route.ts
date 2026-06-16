import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, forceVerifyEmail } from "@/server/admin/users";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/verify-email — set emailVerified=now (doc 16). Role: support.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("support");
    const { id } = await params;

    const result = await forceVerifyEmail(id);
    await logAdminAction({
      actorId: actor.id,
      action: "user.verify_email",
      targetType: "user",
      targetId: id,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, user: result });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

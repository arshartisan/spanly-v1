import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, suspendUser } from "@/server/admin/users";
import { suspendSchema } from "@/lib/schemas/admin-users";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/suspend — set suspendedAt=now (doc 16). Role: support.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("support");
    const { id } = await params;

    const parsed = suspendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input.", issues: parsed.error.flatten() }, { status: 422 });
    }

    const result = await suspendUser(actor.id, id, parsed.data.reason);
    await logAdminAction({
      actorId: actor.id,
      action: "user.suspend",
      targetType: "user",
      targetId: id,
      metadata: { reason: parsed.data.reason },
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

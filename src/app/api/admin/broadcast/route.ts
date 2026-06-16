import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, sendBroadcast } from "@/server/admin/support";
import { broadcastSchema } from "@/lib/schemas/admin-support";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/broadcast — send a broadcast email to an audience (doc 21). Role: superadmin.
// Audit records only audience + recipientCount — never the subject, body, or recipient list.
export async function POST(req: Request) {
  try {
    const actor = await requireRole("superadmin");

    const parsed = broadcastSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { recipientCount } = await sendBroadcast(actor, parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "broadcast.send",
      metadata: { audience: parsed.data.audience, recipientCount },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, recipientCount });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

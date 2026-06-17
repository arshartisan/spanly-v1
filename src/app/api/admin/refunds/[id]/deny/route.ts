import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, denyRefund } from "@/server/admin/billing";
import { denyRefundSchema } from "@/lib/schemas/admin-billing";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/refunds/:id/deny - deny a pending refund (doc 17). Role: admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;

    const parsed = denyRefundSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const request = await denyRefund(actor.id, id, parsed.data.note);
    await logAdminAction({
      actorId: actor.id,
      action: "refund.deny",
      targetType: "refundRequest",
      targetId: id,
      metadata: { userId: request.userId, note: parsed.data.note },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, refund: request });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

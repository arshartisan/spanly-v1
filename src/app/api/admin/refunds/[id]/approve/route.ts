import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, approveRefund } from "@/server/admin/billing";
import { approveRefundSchema } from "@/lib/schemas/admin-billing";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/refunds/:id/approve — approve & issue a refund (doc 17). Role: admin;
// out-of-policy forced refunds require superadmin (enforced when `force` is set).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = approveRefundSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    // Forcing an out-of-policy refund is a superadmin action; ordinary approvals are admin.
    const actor = await requireRole(parsed.data.force ? "superadmin" : "admin");
    const { id } = await params;

    const request = await approveRefund(actor.id, id, parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "refund.approve",
      targetType: "refundRequest",
      targetId: id,
      metadata: {
        userId: request.userId,
        amount: request.amount,
        force: parsed.data.force ?? false,
        providerRefundId: request.providerRefundId,
        note: parsed.data.note,
      },
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

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, createStaffRefund, listRefundRequests } from "@/server/admin/billing";
import { refundStatusFilterSchema, staffRefundSchema } from "@/lib/schemas/admin-billing";
import { clientIp } from "@/server/rate-limit";

// GET /api/admin/refunds - refund-request queue (doc 17). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");
    const url = new URL(req.url);
    const parsed = refundStatusFilterSchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const refunds = await listRefundRequests(parsed.data.status);
    return NextResponse.json({ refunds });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

// POST /api/admin/refunds - staff-initiated pending refund request (doc 17). Role: admin.
export async function POST(req: Request) {
  try {
    const actor = await requireRole("admin");
    const parsed = staffRefundSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const request = await createStaffRefund(
      actor.id,
      parsed.data.userId,
      parsed.data.amount,
      parsed.data.reason,
    );
    await logAdminAction({
      actorId: actor.id,
      action: "refund.create",
      targetType: "refundRequest",
      targetId: request.id,
      metadata: {
        userId: parsed.data.userId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
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

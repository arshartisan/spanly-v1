import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, grantCredit } from "@/server/admin/billing";
import { grantCreditSchema } from "@/lib/schemas/admin-billing";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/credit — grant account credit (doc 17). Role: superadmin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("superadmin");
    const { id } = await params;

    const parsed = grantCreditSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await grantCredit(actor.id, id, parsed.data.amount, parsed.data.reason);
    await logAdminAction({
      actorId: actor.id,
      action: "credit.grant",
      targetType: "user",
      targetId: id,
      metadata: { amount: parsed.data.amount, reason: parsed.data.reason },
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

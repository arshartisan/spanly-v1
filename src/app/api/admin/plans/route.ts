import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, createPlan, listPlansAdmin } from "@/server/admin/plans";
import { planCreateSchema } from "@/lib/schemas/admin-plans";
import { clientIp } from "@/server/rate-limit";

// GET /api/admin/plans - list all plan tiers (incl. inactive) with subscriber counts. Role: admin.
export async function GET() {
  try {
    await requireRole("admin");
    const plans = await listPlansAdmin();
    return NextResponse.json({ plans });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

// POST /api/admin/plans - create a plan tier. Role: admin. Audited as `plan.create`.
export async function POST(req: Request) {
  try {
    const actor = await requireRole("admin");

    const parsed = planCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const plan = await createPlan(actor.id, parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "plan.create",
      targetType: "plan",
      targetId: plan.key,
      metadata: {
        key: plan.key,
        name: plan.name,
        monthly: plan.monthly,
        yearly: plan.yearly,
        accountLimit: plan.accountLimit,
        rank: plan.rank,
        isPublic: plan.isPublic,
        active: plan.active,
      },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

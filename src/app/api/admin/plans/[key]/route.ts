import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, deletePlan, updatePlan } from "@/server/admin/plans";
import { planUpdateSchema } from "@/lib/schemas/admin-plans";
import { clientIp } from "@/server/rate-limit";

// PATCH /api/admin/plans/:key - patch a plan tier (key immutable). Role: admin.
// Audited as `plan.update` with { key, before, after }.
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { key } = await params;

    const parsed = planUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const before = await prisma.plan.findUnique({ where: { key } });
    const plan = await updatePlan(actor.id, key, parsed.data);

    await logAdminAction({
      actorId: actor.id,
      action: "plan.update",
      targetType: "plan",
      targetId: key,
      metadata: { key, before, after: plan },
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

// DELETE /api/admin/plans/:key - delete a plan tier. Role: superadmin (destructive).
// Audited as `plan.delete`. Guards in deletePlan: 404 missing, 409 has subscribers / last active.
export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireRole("superadmin");
    const { key } = await params;

    const before = await prisma.plan.findUnique({ where: { key } });
    await deletePlan(actor.id, key);

    await logAdminAction({
      actorId: actor.id,
      action: "plan.delete",
      targetType: "plan",
      targetId: key,
      metadata: { key, before },
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

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, updateUserProfile } from "@/server/admin/users";
import { deleteUser } from "@/server/admin/support";
import { updateUserSchema } from "@/lib/schemas/admin-users";
import { gdprActionSchema } from "@/lib/schemas/admin-support";
import { clientIp } from "@/server/rate-limit";

// PATCH /api/admin/users/:id - update displayName/email (doc 16). Role: admin.
// Email is non-secret and safe to audit; a staff email change resets emailVerified.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;

    const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input.", issues: parsed.error.flatten() }, { status: 422 });
    }

    const result = await updateUserProfile(id, parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "user.update",
      targetType: "user",
      targetId: id,
      metadata: { fields: Object.keys(parsed.data), ...parsed.data },
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

// DELETE /api/admin/users/:id - GDPR hard delete (doc 21). Role: superadmin.
// Blocked for self, superadmins, and users with an active paid subscription (cancel first).
// Cascades per Prisma relations; audits the reason only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("superadmin");
    const { id } = await params;

    const parsed = gdprActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await deleteUser(actor.id, id, parsed.data.reason);
    await logAdminAction({
      actorId: actor.id,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      metadata: { reason: parsed.data.reason },
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

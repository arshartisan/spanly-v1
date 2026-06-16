import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, updateUserProfile } from "@/server/admin/users";
import { updateUserSchema } from "@/lib/schemas/admin-users";
import { clientIp } from "@/server/rate-limit";

// PATCH /api/admin/users/:id — update displayName/email (doc 16). Role: admin.
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

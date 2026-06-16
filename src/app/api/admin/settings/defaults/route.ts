import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { getEditableDefaults, setEditableDefaults } from "@/server/settings/config";
import { defaultsUpdateSchema } from "@/lib/schemas/admin-plans";
import { clientIp } from "@/server/rate-limit";

// GET /api/admin/settings/defaults — read the editable platform defaults. Role: admin.
export async function GET() {
  try {
    await requireRole("admin");
    const defaults = await getEditableDefaults();
    return NextResponse.json({ defaults });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

// PATCH /api/admin/settings/defaults — edit the platform defaults. Role: admin.
// Audited as `defaults.update` with { before, after }.
export async function PATCH(req: Request) {
  try {
    const actor = await requireRole("admin");

    const parsed = defaultsUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const before = await getEditableDefaults();
    const after = await setEditableDefaults(parsed.data);

    await logAdminAction({
      actorId: actor.id,
      action: "defaults.update",
      targetType: "config",
      metadata: { before: { ...before }, after: { ...after } },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, defaults: after });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

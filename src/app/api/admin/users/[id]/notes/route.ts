import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, addSupportNote } from "@/server/admin/users";
import { noteSchema } from "@/lib/schemas/admin-users";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/notes - add a support note (doc 16). Role: support.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("support");
    const { id } = await params;

    const parsed = noteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input.", issues: parsed.error.flatten() }, { status: 422 });
    }

    const note = await addSupportNote(actor.id, id, parsed.data.body);
    await logAdminAction({
      actorId: actor.id,
      action: "user.note_add",
      targetType: "user",
      targetId: id,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

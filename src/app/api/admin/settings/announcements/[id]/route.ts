import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { deleteAnnouncement, updateAnnouncement } from "@/server/settings/flags";
import { announcementUpdateSchema } from "@/lib/schemas/admin-settings";
import { clientIp } from "@/server/rate-limit";

// PATCH /api/admin/settings/announcements/:id — patch an announcement (doc 20). Role: admin.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;

    const parsed = announcementUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const announcement = await updateAnnouncement(id, parsed.data);
    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    await logAdminAction({
      actorId: actor.id,
      action: "announcement.update",
      targetType: "announcement",
      targetId: id,
      metadata: { active: announcement.active, audience: announcement.audience },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

// DELETE /api/admin/settings/announcements/:id — delete an announcement (doc 20). Role: admin.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;

    const deleted = await deleteAnnouncement(id);
    if (!deleted) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    await logAdminAction({
      actorId: actor.id,
      action: "announcement.delete",
      targetType: "announcement",
      targetId: id,
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

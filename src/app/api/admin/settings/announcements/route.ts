import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { createAnnouncement, listAnnouncements } from "@/server/settings/flags";
import { announcementCreateSchema } from "@/lib/schemas/admin-settings";
import { clientIp } from "@/server/rate-limit";

// GET /api/admin/settings/announcements — list all announcements (doc 20). Role: admin.
export async function GET() {
  try {
    await requireRole("admin");
    const announcements = await listAnnouncements();
    return NextResponse.json({ announcements });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

// POST /api/admin/settings/announcements — create an announcement (doc 20). Role: admin.
export async function POST(req: Request) {
  try {
    const actor = await requireRole("admin");

    const parsed = announcementCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const announcement = await createAnnouncement(parsed.data, actor.id);
    await logAdminAction({
      actorId: actor.id,
      action: "announcement.create",
      targetType: "announcement",
      targetId: announcement.id,
      metadata: { severity: announcement.severity, audience: announcement.audience },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

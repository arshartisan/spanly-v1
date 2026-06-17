import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, cancelPost } from "@/server/admin/content";
import { moderationActionSchema } from "@/lib/schemas/admin-content";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/content/:postId/cancel - cancel a scheduled post (doc 18). Role: admin.
export async function POST(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { postId } = await params;

    const parsed = moderationActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await cancelPost(actor.id, postId, parsed.data.reason);
    await logAdminAction({
      actorId: actor.id,
      action: "content.cancel",
      targetType: "post",
      targetId: postId,
      metadata: { reason: parsed.data.reason },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

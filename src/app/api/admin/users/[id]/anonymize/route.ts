import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, anonymizeUser } from "@/server/admin/support";
import { gdprActionSchema } from "@/lib/schemas/admin-support";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/anonymize - GDPR scrub PII + revoke access (doc 21). Role: superadmin.
// Audit records the reason only - never the scrubbed PII or any OAuth tokens.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    await anonymizeUser(actor.id, id, parsed.data.reason);
    await logAdminAction({
      actorId: actor.id,
      action: "user.anonymize",
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

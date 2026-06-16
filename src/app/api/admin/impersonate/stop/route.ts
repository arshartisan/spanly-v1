import { NextResponse } from "next/server";
import { logAdminAction } from "@/server/admin/audit";
import { stopImpersonation } from "@/server/admin/support";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/impersonate/stop — exit impersonation, restore the staff session (doc 21).
// NOT requireRole-gated: the effective user is the impersonated target. Authorization is the
// impersonation session itself — `stopImpersonation` returns null (→ 400) when the caller
// isn't impersonating. Audited as the impersonator (the acting staff member).
export async function POST(req: Request) {
  try {
    const result = await stopImpersonation();
    if (!result) {
      return NextResponse.json({ error: "Not impersonating." }, { status: 400 });
    }
    await logAdminAction({
      actorId: result.impersonatorId,
      action: "user.impersonate.stop",
      targetType: "user",
      targetId: result.targetId,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

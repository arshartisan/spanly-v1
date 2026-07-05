import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole, roleAtLeast } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { getFlag, setFlag } from "@/server/settings/flags";
import { flagPatchSchema } from "@/lib/schemas/admin-settings";
import { clientIp } from "@/server/rate-limit";

// PATCH /api/admin/settings/flags/:key - toggle a feature flag (doc 20). Role: admin, BUT the
// global kill switches (signups, publishing) + maintenance-mode + waitlist-mode require
// superadmin. Audited with before/after { key, enabled }.
const SUPERADMIN_ONLY = new Set(["maintenance-mode", "waitlist-mode", "signups", "publishing"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { key } = await params;

    if (SUPERADMIN_ONLY.has(key) && !roleAtLeast(actor.role, "superadmin")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const parsed = flagPatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const before = await getFlag(key);
    const value =
      parsed.data.value === undefined ? undefined : (parsed.data.value as Prisma.InputJsonValue);
    const flag = await setFlag(key, parsed.data.enabled, value, actor.id);

    await logAdminAction({
      actorId: actor.id,
      action: "flag.update",
      targetType: "flag",
      targetId: key,
      metadata: {
        key,
        before: before ? before.enabled : null,
        after: flag.enabled,
      },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, flag });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

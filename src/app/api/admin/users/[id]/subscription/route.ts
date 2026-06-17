import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { logAdminAction } from "@/server/admin/audit";
import { AdminActionError, overrideSubscription } from "@/server/admin/billing";
import { overrideSubscriptionSchema } from "@/lib/schemas/admin-billing";
import { clientIp } from "@/server/rate-limit";

// POST /api/admin/users/:id/subscription - manual subscription override (doc 17). Role: superadmin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("superadmin");
    const { id } = await params;

    const parsed = overrideSubscriptionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const sub = await overrideSubscription(actor.id, id, parsed.data);
    await logAdminAction({
      actorId: actor.id,
      action: "subscription.override",
      targetType: "user",
      targetId: id,
      metadata: {
        plan: parsed.data.plan,
        interval: parsed.data.interval,
        status: parsed.data.status,
        trialEndsAt:
          parsed.data.trialEndsAt instanceof Date
            ? parsed.data.trialEndsAt.toISOString()
            : parsed.data.trialEndsAt,
      },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listSubscriptions } from "@/server/admin/billing";
import { subscriptionListQuerySchema } from "@/lib/schemas/admin-billing";

// GET /api/admin/subscriptions — list subscriptions with optional filters (doc 17). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");
    const url = new URL(req.url);
    const parsed = subscriptionListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      plan: url.searchParams.get("plan") ?? undefined,
      interval: url.searchParams.get("interval") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const subscriptions = await listSubscriptions(parsed.data);
    return NextResponse.json({ subscriptions });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

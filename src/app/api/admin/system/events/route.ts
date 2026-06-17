import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listWebhookEvents } from "@/server/admin/ops";
import { webhookEventQuerySchema } from "@/lib/schemas/admin-ops";

export const dynamic = "force-dynamic";

// GET /api/admin/system/events?source= — webhook/PayPal event log (doc 19). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = webhookEventQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await listWebhookEvents(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

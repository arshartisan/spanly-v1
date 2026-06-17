import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { toggleApiAddon } from "@/server/billing";

const schema = z.object({ enable: z.boolean() });

// POST /api/billing/addons/api - enable/disable the $5/mo API add-on (doc 10).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!user.subscription) {
    return NextResponse.json({ error: "No active subscription." }, { status: 402 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 422 });

  try {
    const result = await toggleApiAddon(user.id, parsed.data.enable);
    // Live enable returns a PayPal approval URL the client must redirect to; the webhook
    // flips apiAddonActive once the add-on subscription activates.
    return NextResponse.json({ ok: true, apiAddonActive: result.enabled, url: result.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update add-on.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

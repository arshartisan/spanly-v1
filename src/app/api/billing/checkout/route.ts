import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { createCheckout } from "@/server/billing";

const schema = z.object({
  plan: z.enum(["creator", "growth", "pro"]),
  interval: z.enum(["month", "year"]),
});

// POST /api/billing/checkout — start a subscription checkout (doc 10). Returns { url } for the
// client to redirect to (live: Stripe Checkout; mock: internal mock checkout page).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan." }, { status: 422 });

  try {
    const { url } = await createCheckout(user.id, user.email, parsed.data.plan, parsed.data.interval);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

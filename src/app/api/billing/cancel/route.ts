import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { cancelSubscription } from "@/server/billing";

// POST /api/billing/cancel — cancel the user's subscription (doc 10). PayPal has no hosted
// billing portal, so cancellation is a direct action: live cancels via the PayPal API, mock
// flips the local row. Returns { ok: true }; the client refreshes to show the canceled state.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await cancelSubscription(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not cancel subscription.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

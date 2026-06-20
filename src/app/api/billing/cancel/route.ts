import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { cancelSubscription } from "@/server/billing";

// POST /api/billing/cancel - cancel the user's subscription at period end (doc 10). Live schedules
// cancellation on Polar (cancelAtPeriodEnd); mock flips the local flag. Access persists until the
// period ends. Returns { ok: true }; the client refreshes to show the scheduled-cancel state.
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

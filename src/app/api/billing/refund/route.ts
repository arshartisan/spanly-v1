import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { requestRefund } from "@/server/billing";

// POST /api/billing/refund — request a refund within the 7-day window (doc 10 / D-016).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await requestRefund(user.id, user.email);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

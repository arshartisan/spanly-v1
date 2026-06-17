import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { isLiveBilling } from "@/server/billing-config";
import { mockActivate } from "@/server/billing";
import type { BillingInterval } from "@prisma/client";
import type { PlanKey } from "@/server/plans";

const PLANS = ["creator", "growth", "pro"];
const INTERVALS = ["month", "year"];

// GET /api/billing/mock/complete?plan&interval — mock checkout "Subscribe" action. Drives the
// same Subscription upsert the live PayPal webhook would, then returns to Billing. Mock-only.
export async function GET(req: Request) {
  if (isLiveBilling()) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const plan = url.searchParams.get("plan");
  const interval = url.searchParams.get("interval");
  if (!plan || !PLANS.includes(plan) || !interval || !INTERVALS.includes(interval)) {
    return NextResponse.redirect(new URL("/settings/plans?error=invalid", req.url));
  }

  await mockActivate(user.id, plan as PlanKey, interval as BillingInterval);
  return NextResponse.redirect(new URL("/settings/billing?subscribed=1", req.url));
}

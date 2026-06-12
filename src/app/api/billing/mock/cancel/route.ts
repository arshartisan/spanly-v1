import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { isLiveBilling } from "@/server/stripe";
import { mockCancel } from "@/server/billing";

// GET /api/billing/mock/cancel — mock portal "Cancel subscription" action. Mock-only.
export async function GET(req: Request) {
  if (isLiveBilling()) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  if (user.subscription) await mockCancel(user.id);
  return NextResponse.redirect(new URL("/settings/billing?canceled=1", req.url));
}

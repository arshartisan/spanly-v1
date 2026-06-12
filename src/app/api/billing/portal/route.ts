import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { createPortal } from "@/server/billing";

// POST /api/billing/portal — open the billing portal (doc 10). Returns { url }.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { url } = await createPortal(user.id);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not open portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

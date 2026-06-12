import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getQueue, replaceQueue } from "@/server/settings";
import { queuePutSchema } from "@/lib/schemas/settings";

// GET /api/queue — current user's queue slots + settings (doc 11B / doc 08).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  return NextResponse.json(await getQueue(user.id, user.timezone));
}

// PUT /api/queue — replace slots + settings atomically (doc 11B).
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = queuePutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid queue.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const queue = await replaceQueue(user.id, parsed.data);
  return NextResponse.json({ ok: true, queue });
}

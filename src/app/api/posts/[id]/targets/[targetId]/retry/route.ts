import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { retryTarget } from "@/server/posts";

// POST /api/posts/[id]/targets/[targetId]/retry — re-publish a single failed target
// (docs/implementation/09). Successful targets are never touched, so no duplicate posts.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; targetId: string }> },
) {
  const { id, targetId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await retryTarget(user.id, id, targetId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, retried: result.retried });
}

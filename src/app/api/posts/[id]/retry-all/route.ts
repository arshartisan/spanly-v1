import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { retryAllFailed } from "@/server/posts";

// POST /api/posts/[id]/retry-all — re-publish every failed target of a post (the "Retry all"
// affordance for a failed post, docs/implementation/09). Successful targets are left as-is.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await retryAllFailed(user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, retried: result.retried });
}

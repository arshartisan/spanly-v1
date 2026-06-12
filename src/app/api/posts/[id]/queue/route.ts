import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { addToQueue } from "@/server/posts";

const bodySchema = z.object({ targets: z.array(z.string().min(1)).min(1) });

// POST /api/posts/[id]/queue — drop into the next open queue slot
// (docs/implementation/06 + 08).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one account." }, { status: 422 });
  }

  const result = await addToQueue(user.id, id, parsed.data.targets);
  if (!result.ok) return NextResponse.json({ error: result.errors }, { status: result.status });
  return NextResponse.json({
    id: result.post.id,
    status: result.post.status,
    publishAt: result.post.publishAt,
  });
}

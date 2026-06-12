import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { schedulePost } from "@/server/posts";

const bodySchema = z.object({
  targets: z.array(z.string().min(1)).min(1),
  publishAt: z.string().datetime(),
  timezone: z.string().min(1).default("UTC"),
});

// POST /api/posts/[id]/schedule — schedule for a specific UTC instant
// (docs/implementation/06 + 08).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule request." }, { status: 422 });
  }

  const { targets, publishAt, timezone } = parsed.data;
  const result = await schedulePost(user.id, id, targets, new Date(publishAt), timezone);
  if (!result.ok) return NextResponse.json({ error: result.errors }, { status: result.status });
  return NextResponse.json({
    id: result.post.id,
    status: result.post.status,
    publishAt: result.post.publishAt,
  });
}

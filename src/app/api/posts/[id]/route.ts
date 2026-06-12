import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { deletePost, updatePost } from "@/server/posts";
import { updatePostSchema } from "@/lib/schemas/post";

// PATCH /api/posts/[id] — update a draft/scheduled post (docs/implementation/06 + 12).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = updatePostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }

  const post = await updatePost(user.id, id, parsed.data);
  if (!post) return NextResponse.json({ error: "Post not found or not editable." }, { status: 404 });
  return NextResponse.json({ id: post.id, status: post.status });
}

// DELETE /api/posts/[id].
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ok = await deletePost(user.id, id);
  if (!ok) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

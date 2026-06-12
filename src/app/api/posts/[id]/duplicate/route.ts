import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { duplicatePost } from "@/server/posts";

// POST /api/posts/[id]/duplicate — copy a post into a fresh draft (edit screen action,
// docs/implementation/06 + 12).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const copy = await duplicatePost(user.id, id);
  if (!copy) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ id: copy.id, status: copy.status }, { status: 201 });
}

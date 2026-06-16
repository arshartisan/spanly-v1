import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { getPostDetail } from "@/server/admin/content";

// GET /api/admin/content/:postId — full post detail + targets (doc 18). Role: support.
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    await requireRole("support");
    const { postId } = await params;

    const post = await getPostDetail(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

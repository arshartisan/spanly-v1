import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listPosts } from "@/server/admin/content";
import { postListQuerySchema } from "@/lib/schemas/admin-content";

// GET /api/admin/content — cross-user post list with filters + cursor paging (doc 18). Role: support.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = postListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query.", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await listPosts(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

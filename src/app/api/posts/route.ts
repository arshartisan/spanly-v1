import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { createDraft } from "@/server/posts";
import { createPostSchema } from "@/lib/schemas/post";

// POST /api/posts (docs/implementation/06 + 12) — create a draft. Schedule/publish/queue
// transitions happen on the dedicated sub-routes once the draft exists.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = createPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }

  const post = await createDraft(user.id, parsed.data);
  return NextResponse.json({ id: post.id, status: post.status }, { status: 201 });
}

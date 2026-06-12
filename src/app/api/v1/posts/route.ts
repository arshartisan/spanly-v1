import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/server/api-keys";
import { createApiTextPost } from "@/server/posts";

// Public posting API (doc 12). MVP supports text posts; media uploads land in a later release.
const schema = z.object({
  caption: z.string().min(1).max(5000),
  accountIds: z.array(z.string()).min(1).max(50),
  publishAt: z.string().datetime().optional(),
});

// POST /api/v1/posts — create + publish (or schedule) a text post via API key.
export async function POST(req: Request) {
  const auth = await authorizeApiRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.flatten() }, { status: 422 });
  }
  const { caption, accountIds, publishAt } = parsed.data;

  const outcome = await createApiTextPost(auth.userId, {
    caption,
    accountIds,
    publishAt: publishAt ? new Date(publishAt) : undefined,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.errors }, { status: outcome.status });
  }

  return NextResponse.json(
    { id: outcome.post.id, status: outcome.post.status, publishAt: outcome.post.publishAt },
    { status: 201 },
  );
}

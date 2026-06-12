import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { authorizeApiRequest } from "@/server/api-keys";
import { createDraft, publishNow, schedulePost } from "@/server/posts";

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

  const draft = await createDraft(auth.userId, {
    type: "text",
    mainCaption: caption,
    perPlatform: {},
    media: [],
    targets: accountIds,
  });

  let outcome;
  if (publishAt) {
    const when = new Date(publishAt);
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    outcome = await schedulePost(auth.userId, draft.id, accountIds, when, user?.timezone ?? "UTC");
  } else {
    outcome = await publishNow(auth.userId, draft.id, accountIds);
  }

  if (!outcome.ok) {
    // Clean up the orphan draft so a failed dispatch doesn't leave junk behind.
    await prisma.post.deleteMany({ where: { id: draft.id, userId: auth.userId } });
    return NextResponse.json({ error: outcome.errors }, { status: outcome.status });
  }

  return NextResponse.json(
    { id: outcome.post.id, status: outcome.post.status, publishAt: outcome.post.publishAt },
    { status: 201 },
  );
}

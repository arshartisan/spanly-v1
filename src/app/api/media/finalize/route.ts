import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { finalizeSchema } from "@/lib/schemas/post";

// POST /api/media/finalize (docs/implementation/06) — after the browser PUTs the bytes,
// persist the Media row. Server-side processing (ffmpeg normalize/thumbnail) is Phase 5;
// for now processed=false and the public URL is used directly.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = finalizeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }
  const d = parsed.data;

  const media = await prisma.media.create({
    data: {
      userId: user.id,
      kind: d.kind,
      url: d.publicUrl,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      width: d.width,
      height: d.height,
      durationSec: d.durationSec,
      processed: false,
    },
  });

  return NextResponse.json({
    id: media.id,
    kind: media.kind,
    url: media.url,
    width: media.width,
    height: media.height,
  });
}

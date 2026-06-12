import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { presignUpload } from "@/server/storage";
import { presignSchema } from "@/lib/schemas/post";

// POST /api/media/presign (docs/implementation/06) — hand the browser a short-lived PUT URL
// for a direct-to-S3 upload. We don't persist anything yet; that happens in /finalize.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = presignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }

  const { filename, mimeType } = parsed.data;
  const { key, uploadUrl, publicUrl } = await presignUpload({ userId: user.id, filename, mimeType });
  return NextResponse.json({ key, uploadUrl, publicUrl });
}

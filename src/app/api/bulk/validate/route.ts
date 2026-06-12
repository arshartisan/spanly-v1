import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { validateImport } from "@/server/bulk";
import { bulkValidateSchema } from "@/lib/schemas/bulk";

// POST /api/bulk/validate (Phase 9) — parse + validate a CSV into a per-row preview. No writes.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bulkValidateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }

  const preview = await validateImport(user.id, parsed.data);
  return NextResponse.json(preview);
}

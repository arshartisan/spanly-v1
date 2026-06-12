import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { commitImport } from "@/server/bulk";
import { bulkValidateSchema } from "@/lib/schemas/bulk";

// POST /api/bulk/commit (Phase 9) — re-validate server-side, then create + dispatch every
// valid row (draft / scheduled / queued). Invalid rows are skipped; returns per-row outcomes.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bulkValidateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 422 });
  }

  const result = await commitImport(user.id, parsed.data);
  return NextResponse.json(result, { status: 201 });
}

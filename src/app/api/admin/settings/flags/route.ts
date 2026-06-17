import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listFlags } from "@/server/settings/flags";

// GET /api/admin/settings/flags - list stored feature-flag rows (doc 20). Role: admin.
// The UI merges these with KNOWN_FLAGS so unseeded keys still show as default-enabled.
export async function GET() {
  try {
    await requireRole("admin");
    const flags = await listFlags();
    return NextResponse.json({ flags });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

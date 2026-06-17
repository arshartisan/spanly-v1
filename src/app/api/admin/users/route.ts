import { NextResponse } from "next/server";
import { requireRole } from "@/server/admin/access";
import { listUsers } from "@/server/admin/users";
import { userListQuerySchema } from "@/lib/schemas/admin-users";

// GET /api/admin/users - search/filter/paginate users (doc 16). Role: support.
// Read-only; the detail page reads directly in its RSC, so no GET :id route here.
export async function GET(req: Request) {
  try {
    await requireRole("support");

    const url = new URL(req.url);
    const parsed = userListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query.", issues: parsed.error.flatten() }, { status: 422 });
    }

    const result = await listUsers(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

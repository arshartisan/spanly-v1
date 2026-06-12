import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { revokeApiKey } from "@/server/api-keys";

// DELETE /api/api-keys/[id] — revoke a key (doc 12). Revoked keys stop authenticating at once.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const ok = await revokeApiKey(user.id, id);
  if (!ok) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

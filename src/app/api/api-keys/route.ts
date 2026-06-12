import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { createApiKey, listApiKeys, requireApiAddon } from "@/server/api-keys";

const createSchema = z.object({ name: z.string().min(1).max(60) });

// GET /api/api-keys — list the user's active keys (doc 12). Add-on gated.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const gate = requireApiAddon(user.subscription);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  return NextResponse.json({ keys: await listApiKeys(user.id) });
}

// POST /api/api-keys — mint a key; the plaintext is returned exactly once (doc 12).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const gate = requireApiAddon(user.subscription);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A key name is required." }, { status: 422 });

  const { plaintext, key } = await createApiKey(user.id, parsed.data.name);
  return NextResponse.json({ key, plaintext }, { status: 201 });
}

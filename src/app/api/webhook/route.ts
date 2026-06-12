import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { requireApiAddon } from "@/server/api-keys";
import { deleteWebhook, getWebhook, upsertWebhook } from "@/server/webhooks";

const putSchema = z.object({ url: z.string().url().max(2048) });

// GET /api/webhook — current webhook config (url + signing secret), or null (doc 12).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const gate = requireApiAddon(user.subscription);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  return NextResponse.json({ webhook: await getWebhook(user.id) });
}

// PUT /api/webhook — set/replace the callback URL (secret is stable across edits).
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const gate = requireApiAddon(user.subscription);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid URL is required." }, { status: 422 });

  return NextResponse.json({ webhook: await upsertWebhook(user.id, parsed.data.url) });
}

// DELETE /api/webhook — remove the callback.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await deleteWebhook(user.id);
  return NextResponse.json({ ok: true });
}

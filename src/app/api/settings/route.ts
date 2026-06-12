import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { readSettings, updateSettings } from "@/server/settings";
import { settingsPatchSchema } from "@/lib/schemas/settings";

// GET /api/settings — current user's resolved settings + profile fields (doc 11A).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  return NextResponse.json({
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    settings: readSettings(user.settings),
  });
}

// PATCH /api/settings — partial update of profile columns + settings JSON (doc 11A).
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = settingsPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const settings = await updateSettings(user.id, parsed.data);
  return NextResponse.json({ ok: true, settings });
}

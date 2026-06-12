import { NextResponse } from "next/server";
import { destroyAllSessions, getCurrentUser } from "@/server/auth";

// "Sign out of all devices" (doc 03 / doc 11A): deletes every Session row for the
// user, including the current one.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await destroyAllSessions(user.id);
  return NextResponse.json({ ok: true });
}

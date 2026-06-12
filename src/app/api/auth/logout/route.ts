import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth";

// Sign out of the current device only.
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

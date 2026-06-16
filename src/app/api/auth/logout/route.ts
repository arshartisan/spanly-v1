import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth";

// Sign out of the current device only.
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

// GET variant for navigations: clears the session (and its cookie) then redirects to /login.
// Used by the app shell when a session cookie is present but no longer valid (e.g. the row was
// deleted by a re-seed / sign-out-all), which would otherwise cause a redirect loop.
export async function GET(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url));
}

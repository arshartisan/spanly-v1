import { NextResponse } from "next/server";
import { waitlistJoinSchema } from "@/lib/schemas/waitlist";
import { addToWaitlist, waitlistCount } from "@/server/waitlist";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { isEnabled } from "@/server/settings/flags";

// Public waitlist API (doc 20 waitlist mode). Only active while the `waitlist-mode` flag is on -
// outside waitlist mode the endpoint 404s so no list is collected. No auth: it's a public form.

// POST /api/waitlist - enrol an email. Rate-limited per IP, gated on waitlist-mode, idempotent.
// Returns { position, alreadyJoined, count }.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`waitlist:${ip}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  // Only run a waitlist when the site is actually in waitlist mode. Absent flag → not in mode.
  if (!(await isEnabled("waitlist-mode"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = waitlistJoinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { email, source } = parsed.data;
  const { position, alreadyJoined } = await addToWaitlist(email, {
    ip,
    source: source ?? "landing",
  });
  const count = await waitlistCount();

  return NextResponse.json({ position, alreadyJoined, count });
}

// GET /api/waitlist - the public social-proof counter. Lightly rate-limited; returns { count }.
export async function GET(req: Request) {
  const rl = await rateLimit(`waitlist-count:${clientIp(req)}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const count = await waitlistCount();
  return NextResponse.json({ count });
}

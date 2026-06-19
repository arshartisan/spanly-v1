import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { requirePlanGate } from "@/server/plans";
import { rateLimit } from "@/server/rate-limit";
import { aiCaptionSchema } from "@/lib/schemas/post";
import { generateCaption, isAiCaptionConfigured } from "@/server/ai-caption";

// POST /api/ai/caption — generate an enhanced caption + hashtags from the user's draft.
// Paid-plan only; rate-limited per user to protect the upstream Gemini quota/cost.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // Paid-plan gate (live DB-backed). "creator" is the entry paid tier; trials pass.
  const gate = await requirePlanGate(user.subscription, "creator");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  // Feature must be configured server-side; surface a clear 503 rather than a vague failure.
  if (!isAiCaptionConfigured()) {
    return NextResponse.json(
      { error: "AI caption assistant is not configured." },
      { status: 503 },
    );
  }

  // Cap usage per user (10/min) so a stuck client or abuse can't run up Gemini cost.
  const rl = await rateLimit(`ai-caption:${user.id}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're generating captions too quickly. Try again in a moment." },
      { status: 429 },
    );
  }

  const parsed = aiCaptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const result = await generateCaption(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ai/caption] generation failed:", err);
    return NextResponse.json({ error: "Caption generation failed." }, { status: 502 });
  }
}

import "server-only";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { captionLimitFor, type PostTypeKey } from "@/lib/schemas/post";
import type { GeneratedCaption } from "@/components/composer/types";

/**
 * AI caption + hashtag generation via the Google Gemini REST API. Thin fetch-based client in
 * the same spirit as a thin REST client (no SDK dependency). Powers the composer's
 * "Enhance with AI" action: a rough draft + the selected platforms → a polished caption and a
 * set of suitable hashtags.
 *
 * Requires GEMINI_API_KEY (from Google AI Studio). The free tier of gemini-2.5-flash is ample
 * for this — a Gemini Advanced consumer subscription does NOT grant API access.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Default model; overridable via env so we can move to a cheaper/newer flash model. */
function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/** The API key, or null when the feature isn't configured (route turns this into a 503). */
export function geminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/** Whether the AI caption feature is configured at all. */
export function isAiCaptionConfigured(): boolean {
  return geminiApiKey() !== null;
}

export type { GeneratedCaption };

export interface GenerateCaptionInput {
  draft: string;
  platforms: PlatformKey[];
  type: PostTypeKey;
}

/** Structured-output schema so Gemini returns clean JSON instead of free text we must parse. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    caption: { type: "STRING" },
    hashtags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["caption", "hashtags"],
} as const;

function buildPrompt(input: GenerateCaptionInput): string {
  const limit = captionLimitFor(input.platforms);
  const labels = input.platforms.map((p) => PLATFORM_CONFIG[p].label).join(", ");
  const draft = input.draft.trim();

  return [
    `You are a social media copywriter. Write one engaging ${input.type} post caption that works for these platforms: ${labels}.`,
    draft
      ? `Base it on the user's draft (improve clarity, hook, and flow; keep their intent and any specific facts):\n"""\n${draft}\n"""`
      : `The user has not written a draft yet. Infer a sensible, on-brand caption for a ${input.type} post.`,
    `Hard rules:`,
    `- The "caption" must be at most ${limit} characters (the strictest limit across the selected platforms) and must NOT include the hashtags inline.`,
    `- Return 5 to 12 relevant, specific hashtags in "hashtags". Each must start with "#", be a single token (no spaces), and contain no punctuation other than the leading "#".`,
    `- Match a natural, human tone for ${labels}. No markdown, no surrounding quotes, no emoji spam.`,
  ].join("\n");
}

/** Shape of the slice of the Gemini generateContent response we read. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Call Gemini and return a normalized caption + hashtags. Throws on a missing key, a non-2xx
 * response, a safety block, or an unparseable body — the API route maps these to HTTP errors.
 */
export async function generateCaption(input: GenerateCaptionInput): Promise<GeneratedCaption> {
  const key = geminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set — AI caption assistant is disabled.");

  const res = await fetch(`${GEMINI_BASE}/models/${geminiModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini generateContent failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason}).`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON.");
  }

  return normalize(parsed, captionLimitFor(input.platforms));
}

/** Coerce the model output into a safe shape: trim, clamp to the limit, clean hashtags. */
function normalize(parsed: unknown, limit: number): GeneratedCaption {
  const obj = (parsed ?? {}) as { caption?: unknown; hashtags?: unknown };

  const caption = typeof obj.caption === "string" ? obj.caption.trim().slice(0, limit) : "";

  const hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags
        .filter((h): h is string => typeof h === "string")
        .map((h) => {
          const tag = h.trim().replace(/\s+/g, "");
          return tag.startsWith("#") ? tag : `#${tag}`;
        })
        .filter((h) => h.length > 1)
        .slice(0, 12)
    : [];

  if (!caption && hashtags.length === 0) {
    throw new Error("Gemini returned no usable caption or hashtags.");
  }
  return { caption, hashtags };
}

import { z } from "zod";
import { PLATFORM_CONFIG, type Capability, type PlatformKey } from "@/lib/platforms";

// Composer validation (doc 06). Shared by API route handlers and the client composer.
// The DB stores `perPlatform` as a map { [socialAccountId]: captionOverride }.

export const POST_TYPES = ["text", "image", "video", "story"] as const;
export type PostTypeKey = (typeof POST_TYPES)[number];

export const postTypeSchema = z.enum(POST_TYPES);

const mediaRefSchema = z.object({
  mediaId: z.string().min(1),
  order: z.number().int().min(0),
});

// Caption cap is generous here (5000 = highest single-platform limit); the strict
// per-account check happens in validatePostTargets using provider limits.
const captionSchema = z.string().max(5000);

export const createPostSchema = z.object({
  type: postTypeSchema,
  mainCaption: captionSchema.default(""),
  perPlatform: z.record(z.string(), captionSchema).default({}),
  targets: z.array(z.string().min(1)).default([]),
  media: z.array(mediaRefSchema).default([]),
});

export const updatePostSchema = createPostSchema.partial();

export const scheduleSchema = z.object({
  // ISO instant in UTC; the client converts the local pick using the post timezone.
  publishAt: z.string().datetime(),
  timezone: z.string().min(1).default("UTC"),
});

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

export const finalizeSchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  kind: z.enum(["image", "video", "pdf"]),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSec: z.number().positive().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type PresignInput = z.infer<typeof presignSchema>;
export type FinalizeInput = z.infer<typeof finalizeSchema>;

/**
 * Caption counter limit shown in the composer = the strictest (minimum) captionMax
 * across the selected platforms. Empty selection falls back to the global max so the
 * user isn't blocked before picking an account.
 */
export function captionLimitFor(platforms: PlatformKey[]): number {
  if (platforms.length === 0) return 5000;
  return Math.min(...platforms.map((p) => PLATFORM_CONFIG[p].limits.captionMax));
}

/** The resolved caption used for a given account = its override, else the main caption. */
export function resolveCaption(
  mainCaption: string,
  perPlatform: Record<string, string>,
  socialAccountId: string,
): string {
  const override = perPlatform[socialAccountId];
  return override && override.trim().length > 0 ? override : mainCaption;
}

export interface AccountValidationError {
  socialAccountId: string;
  platform: PlatformKey;
  errors: string[];
}

/**
 * Per-account composer validation, mirroring provider.validate (doc 02/06) but resolved
 * against each account's effective caption + the shared media set. Pure + isomorphic so
 * the client can surface inline errors and the server can re-check before persisting.
 */
export function validatePostTargets(input: {
  type: PostTypeKey;
  mainCaption: string;
  perPlatform: Record<string, string>;
  mediaCount: number;
  accounts: { id: string; platform: PlatformKey; capabilities: Capability[] }[];
}): AccountValidationError[] {
  const out: AccountValidationError[] = [];

  for (const account of input.accounts) {
    const cfg = PLATFORM_CONFIG[account.platform];
    const { captionMax, mediaMax, supportsStory } = cfg.limits;
    const caption = resolveCaption(input.mainCaption, input.perPlatform, account.id);
    const errors: string[] = [];

    if (!account.capabilities.includes(input.type)) {
      errors.push(`${cfg.label} doesn't support ${input.type} posts`);
    }
    if (caption.length > captionMax) {
      errors.push(`Caption is over the ${captionMax}-character limit for ${cfg.label}`);
    }
    if (input.mediaCount > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for ${cfg.label}`);
    }
    if (input.type === "story") {
      if (!supportsStory) errors.push(`${cfg.label} doesn't support stories`);
      if (input.mediaCount !== 1) errors.push("Stories require exactly one media item");
    }
    if ((input.type === "image" || input.type === "video") && input.mediaCount === 0) {
      errors.push(`${input.type} posts require at least one media item`);
    }
    if (input.type === "text" && caption.trim().length === 0) {
      errors.push("Text posts require a caption");
    }

    if (errors.length > 0) {
      out.push({ socialAccountId: account.id, platform: account.platform, errors });
    }
  }

  return out;
}

/** Whether the composer's submit buttons should be enabled (doc 06 gating rule). */
export function canSubmit(input: {
  type: PostTypeKey;
  targets: string[];
  mainCaption: string;
  mediaCount: number;
  validationErrors: AccountValidationError[];
}): boolean {
  if (input.targets.length === 0) return false;
  const hasContent = input.mainCaption.trim().length > 0 || input.mediaCount > 0;
  if (!hasContent) return false;
  return input.validationErrors.length === 0;
}

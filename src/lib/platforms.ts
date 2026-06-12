/**
 * Single source of truth for the 6 supported platforms: capabilities + publishing limits.
 * Used by the composer (doc 06), provider abstraction (doc 02), and the seed.
 * Values are seed defaults — refine against each real platform API in Phase 6.
 */
export const PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"] as const;
export type PlatformKey = (typeof PLATFORMS)[number];

export type Capability = "text" | "image" | "video" | "story";

export interface PlatformLimits {
  captionMax: number;
  mediaMax: number;
  videoMaxSeconds?: number;
  supportsStory: boolean;
}

export interface PlatformConfig {
  key: PlatformKey;
  label: string;
  capabilities: Capability[];
  limits: PlatformLimits;
  /** Instagram offers a connect-method choice (Instagram login vs Facebook login). */
  hasConnectMethodChoice?: boolean;
}

export const PLATFORM_CONFIG: Record<PlatformKey, PlatformConfig> = {
  x: {
    key: "x",
    label: "X",
    capabilities: ["text", "image", "video"],
    limits: { captionMax: 280, mediaMax: 4, videoMaxSeconds: 140, supportsStory: false },
  },
  linkedin: {
    key: "linkedin",
    label: "LinkedIn",
    capabilities: ["text", "image", "video"],
    limits: { captionMax: 3000, mediaMax: 9, videoMaxSeconds: 600, supportsStory: false },
  },
  facebook: {
    key: "facebook",
    label: "Facebook",
    capabilities: ["text", "image", "video"],
    limits: { captionMax: 5000, mediaMax: 10, videoMaxSeconds: 1200, supportsStory: false },
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    capabilities: ["image", "video", "story"],
    limits: { captionMax: 2200, mediaMax: 10, videoMaxSeconds: 90, supportsStory: true },
    hasConnectMethodChoice: true,
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    capabilities: ["image", "video"],
    limits: { captionMax: 2200, mediaMax: 35, videoMaxSeconds: 600, supportsStory: false },
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    capabilities: ["video"],
    limits: { captionMax: 5000, mediaMax: 1, videoMaxSeconds: 60, supportsStory: false },
  },
};

/** Eligible platforms for a given post type (drives the composer account row, doc 06). */
export function platformsForType(type: Capability): PlatformKey[] {
  return PLATFORMS.filter((p) => PLATFORM_CONFIG[p].capabilities.includes(type));
}

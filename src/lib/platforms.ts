/**
 * Single source of truth for the 6 supported platforms: capabilities + publishing limits.
 * Used by the composer (doc 06), provider abstraction (doc 02), and the seed.
 * Values are seed defaults - refine against each real platform API in Phase 6.
 */
export const PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"] as const;
export type PlatformKey = (typeof PLATFORMS)[number];

export type Capability = "text" | "image" | "video";

export interface PlatformLimits {
  captionMax: number;
  mediaMax: number;
  videoMaxSeconds?: number;
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
    limits: { captionMax: 280, mediaMax: 4, videoMaxSeconds: 140 },
  },
  linkedin: {
    key: "linkedin",
    label: "LinkedIn",
    // Video is intentionally NOT supported: our LinkedIn live publishing handles image
    // media only (see providers/linkedin publishImage), so we don't advertise video here.
    capabilities: ["text", "image"],
    limits: { captionMax: 3000, mediaMax: 9 },
  },
  facebook: {
    key: "facebook",
    label: "Facebook",
    capabilities: ["text", "image", "video"],
    limits: { captionMax: 5000, mediaMax: 10, videoMaxSeconds: 1200 },
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    capabilities: ["image", "video"],
    limits: { captionMax: 2200, mediaMax: 10, videoMaxSeconds: 90 },
    hasConnectMethodChoice: true,
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    capabilities: ["image", "video"],
    limits: { captionMax: 2200, mediaMax: 35, videoMaxSeconds: 600 },
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    capabilities: ["video"],
    limits: { captionMax: 5000, mediaMax: 1, videoMaxSeconds: 60 },
  },
};

/** Eligible platforms for a given post type (drives the composer account row, doc 06). */
export function platformsForType(type: Capability): PlatformKey[] {
  return PLATFORMS.filter((p) => PLATFORM_CONFIG[p].capabilities.includes(type));
}

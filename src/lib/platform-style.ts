import { Facebook, Instagram, Linkedin, Music2, Twitter, Youtube, type LucideIcon } from "lucide-react";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";

/**
 * Presentation metadata for the 6 platforms (icon + brand color) used by the connections
 * UI and chips (docs/implementation/05 + 14). Capabilities/limits live in platforms.ts.
 * lucide has no TikTok glyph — Music2 stands in.
 */
export interface PlatformStyle {
  key: PlatformKey;
  label: string;
  Icon: LucideIcon;
  /** Brand color for the icon badge background. */
  color: string;
}

export const PLATFORM_STYLE: Record<PlatformKey, PlatformStyle> = {
  facebook: { key: "facebook", label: PLATFORM_CONFIG.facebook.label, Icon: Facebook, color: "#1877F2" },
  instagram: { key: "instagram", label: PLATFORM_CONFIG.instagram.label, Icon: Instagram, color: "#E1306C" },
  linkedin: { key: "linkedin", label: PLATFORM_CONFIG.linkedin.label, Icon: Linkedin, color: "#0A66C2" },
  tiktok: { key: "tiktok", label: PLATFORM_CONFIG.tiktok.label, Icon: Music2, color: "#010101" },
  youtube: { key: "youtube", label: PLATFORM_CONFIG.youtube.label, Icon: Youtube, color: "#FF0000" },
  x: { key: "x", label: PLATFORM_CONFIG.x.label, Icon: Twitter, color: "#000000" },
};

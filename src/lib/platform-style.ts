import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
  YoutubeIcon,
  XIcon,
  type BrandIcon,
} from "@/components/icons/brand-icons";
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";

/**
 * Presentation metadata for the 6 platforms (icon + brand color) used by the connections
 * UI and chips (docs/implementation/05 + 14). Capabilities/limits live in platforms.ts.
 * Icons are accurate local brand-logo SVGs (see components/icons/brand-icons.tsx).
 */
export interface PlatformStyle {
  key: PlatformKey;
  label: string;
  Icon: BrandIcon;
  /** Brand color for the icon badge background. */
  color: string;
}

export const PLATFORM_STYLE: Record<PlatformKey, PlatformStyle> = {
  facebook: { key: "facebook", label: PLATFORM_CONFIG.facebook.label, Icon: FacebookIcon, color: "#1877F2" },
  instagram: { key: "instagram", label: PLATFORM_CONFIG.instagram.label, Icon: InstagramIcon, color: "#E1306C" },
  linkedin: { key: "linkedin", label: PLATFORM_CONFIG.linkedin.label, Icon: LinkedinIcon, color: "#0A66C2" },
  tiktok: { key: "tiktok", label: PLATFORM_CONFIG.tiktok.label, Icon: TiktokIcon, color: "#010101" },
  youtube: { key: "youtube", label: PLATFORM_CONFIG.youtube.label, Icon: YoutubeIcon, color: "#FF0000" },
  x: { key: "x", label: PLATFORM_CONFIG.x.label, Icon: XIcon, color: "#000000" },
};

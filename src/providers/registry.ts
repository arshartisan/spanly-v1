/**
 * Provider registry (docs/implementation/02). Returns the right PlatformProvider per
 * platform, honoring PROVIDER_MODE and per-platform PROVIDER_LIVE_<P> flags.
 *
 * Phase 1: only MockProvider exists. Real providers are added in Phase 6 and switched on
 * one at a time without touching callers.
 */
import type { PlatformKey } from "@/lib/platforms";
import type { PlatformProvider } from "@/providers/types";
import { MockProvider } from "@/providers/mock";
import { XProvider } from "@/providers/x";
import { LinkedinProvider } from "@/providers/linkedin";
import { FacebookProvider } from "@/providers/facebook";
import { InstagramProvider } from "@/providers/instagram";
import { TiktokProvider } from "@/providers/tiktok";
import { YoutubeProvider } from "@/providers/youtube";

const mockCache = new Map<PlatformKey, MockProvider>();
const liveCache = new Map<PlatformKey, PlatformProvider>();

/** Construct the real provider for a platform, or null if not implemented yet. */
function liveProvider(platform: PlatformKey): PlatformProvider | null {
  let p = liveCache.get(platform);
  if (p) return p;
  switch (platform) {
    case "x":
      p = new XProvider();
      break;
    case "linkedin":
      p = new LinkedinProvider();
      break;
    case "facebook":
      p = new FacebookProvider();
      break;
    case "instagram":
      p = new InstagramProvider();
      break;
    case "tiktok":
      p = new TiktokProvider();
      break;
    case "youtube":
      p = new YoutubeProvider();
      break;
    default:
      return null;
  }
  liveCache.set(platform, p);
  return p;
}

function mock(platform: PlatformKey): MockProvider {
  let p = mockCache.get(platform);
  if (!p) {
    p = new MockProvider(platform);
    mockCache.set(platform, p);
  }
  return p;
}

// Platforms that always use the real provider — the mock/demo connection is removed for
// these regardless of PROVIDER_MODE or the per-platform live flag.
const ALWAYS_LIVE = new Set<PlatformKey>(["linkedin", "instagram", "tiktok"]);

function isLive(platform: PlatformKey): boolean {
  if (ALWAYS_LIVE.has(platform)) return true;
  if ((process.env.PROVIDER_MODE ?? "mock") !== "live") return false;
  return process.env[`PROVIDER_LIVE_${platform.toUpperCase()}`] === "true";
}

/** True when a platform always uses its real provider (no mock/demo connection). */
export function isAlwaysLive(platform: PlatformKey): boolean {
  return ALWAYS_LIVE.has(platform);
}

export function getProvider(platform: PlatformKey): PlatformProvider {
  if (isLive(platform)) {
    const live = liveProvider(platform);
    if (live) return live;
    // Flag is on but no real provider yet — fall back to mock rather than break.
  }
  return mock(platform);
}

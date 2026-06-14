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
    // facebook / instagram / tiktok / youtube: add real providers here.
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

function isLive(platform: PlatformKey): boolean {
  if ((process.env.PROVIDER_MODE ?? "mock") !== "live") return false;
  return process.env[`PROVIDER_LIVE_${platform.toUpperCase()}`] === "true";
}

export function getProvider(platform: PlatformKey): PlatformProvider {
  if (isLive(platform)) {
    const live = liveProvider(platform);
    if (live) return live;
    // Flag is on but no real provider yet — fall back to mock rather than break.
  }
  return mock(platform);
}

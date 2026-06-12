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

const mockCache = new Map<PlatformKey, MockProvider>();

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
    // Real providers slot in here per platform (Phase 6). Until then, fall back to mock.
    // e.g. if (platform === "x") return new XProvider();
  }
  return mock(platform);
}

/**
 * MockProvider (docs/implementation/02) — drives the whole app with no real platform
 * credentials. getAuthUrl points at an internal mock consent page; publish simulates a
 * post and can be forced to fail per-platform via MOCK_FAIL_PLATFORMS.
 */
import { PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import type {
  AuthUrlOptions,
  ExternalAccount,
  PlatformProvider,
  PublishInput,
  PublishResult,
  ProviderTokens,
  ValidationResult,
} from "@/providers/types";

function shouldFail(platform: PlatformKey): boolean {
  return (process.env.MOCK_FAIL_PLATFORMS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(platform);
}

export class MockProvider implements PlatformProvider {
  readonly platform: PlatformKey;
  readonly capabilities;
  readonly limits;

  constructor(platform: PlatformKey) {
    this.platform = platform;
    this.capabilities = PLATFORM_CONFIG[platform].capabilities;
    this.limits = PLATFORM_CONFIG[platform].limits;
  }

  getAuthUrl(opts: AuthUrlOptions): string {
    const params = new URLSearchParams({ state: opts.state });
    if (opts.method) params.set("method", opts.method);
    // Internal page we render (Phase 3) with Allow / Cancel buttons.
    return `/connect/${this.platform}/mock?${params.toString()}`;
  }

  async handleCallback(): Promise<{ tokens: ProviderTokens; account: ExternalAccount }> {
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    return {
      tokens: {
        accessToken: `mock-access-${this.platform}`,
        refreshToken: `mock-refresh-${this.platform}`,
        expiresAt,
        scopes: ["mock.publish"],
      },
      account: {
        externalId: `mock-${this.platform}-1`,
        handle: `demo_${this.platform}`,
        displayName: `Demo ${PLATFORM_CONFIG[this.platform].label}`,
      },
    };
  }

  async refresh(tokens: ProviderTokens): Promise<ProviderTokens> {
    return {
      ...tokens,
      accessToken: `mock-access-${this.platform}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    // Simulate a small amount of latency-free work.
    if (shouldFail(this.platform)) {
      return { ok: false, error: `Mock failure for ${this.platform}`, retryable: true };
    }
    const id = `${this.platform}_${input.idempotencyKey}`;
    return { ok: true, externalPostId: id, url: `https://mock.spanly/${this.platform}/${id}` };
  }

  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult {
    const errors: string[] = [];
    const { captionMax, mediaMax, supportsStory } = this.limits;

    if (!this.capabilities.includes(input.type)) {
      errors.push(`${this.platform} does not support ${input.type} posts`);
    }
    if (input.caption.length > captionMax) {
      errors.push(`Caption exceeds ${captionMax} characters for ${this.platform}`);
    }
    if (input.media.length > mediaMax) {
      errors.push(`Too many media items (max ${mediaMax}) for ${this.platform}`);
    }
    if (input.type === "story") {
      if (!supportsStory) errors.push(`${this.platform} does not support stories`);
      if (input.media.length !== 1) errors.push("Stories require exactly one media item");
    }
    if ((input.type === "image" || input.type === "video") && input.media.length === 0) {
      errors.push(`${input.type} posts require at least one media item`);
    }
    if (input.type === "text" && input.caption.trim().length === 0) {
      errors.push("Text posts require a caption");
    }

    return { ok: errors.length === 0, errors };
  }
}

/**
 * Provider abstraction (docs/implementation/02). All platform-specific OAuth +
 * publishing lives behind PlatformProvider. No platform SDK/HTTP call exists
 * outside src/providers/<platform>/.
 */
import type { Capability, PlatformKey, PlatformLimits } from "@/lib/platforms";

export type { Capability, PlatformKey, PlatformLimits };

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
  scopes: string[];
  extra?: Record<string, string>; // e.g. pageId for Meta
}

export interface ExternalAccount {
  externalId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  pageId?: string;
}

export interface PublishMedia {
  kind: "image" | "video" | "pdf";
  url: string;
  order: number;
}

export interface PublishInput {
  type: "text" | "image" | "video" | "story";
  caption: string;
  media: PublishMedia[];
  idempotencyKey: string;
}

export type PublishResult =
  | { ok: true; externalPostId: string; url?: string }
  | { ok: false; error: string; retryable: boolean };

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface AuthUrlOptions {
  state: string;
  redirectUri: string;
  method?: "instagram" | "facebook"; // Instagram connect-method choice
}

export interface PlatformProvider {
  readonly platform: PlatformKey;
  readonly capabilities: Capability[];
  readonly limits: PlatformLimits;

  // OAuth (doc 05/14)
  getAuthUrl(opts: AuthUrlOptions): string;
  handleCallback(opts: { code: string; redirectUri: string }): Promise<{
    tokens: ProviderTokens;
    account: ExternalAccount;
  }>;
  refresh(tokens: ProviderTokens): Promise<ProviderTokens>;

  // Publishing (doc 09)
  publish(input: PublishInput, tokens: ProviderTokens): Promise<PublishResult>;

  // Composer validation (doc 06)
  validate(input: Omit<PublishInput, "idempotencyKey">): ValidationResult;
}

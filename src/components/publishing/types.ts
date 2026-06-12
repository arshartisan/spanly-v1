import type { PlatformKey } from "@/lib/platforms";

// Client-side shape of the publishing state returned by GET /api/posts/[id] (doc 09).
export type PublishingTargetView = {
  id: string;
  platform: PlatformKey;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  accountStatus: string;
  caption: string;
  status: "pending" | "publishing" | "success" | "failed";
  externalUrl: string | null;
  error: string | null;
};

export type PublishingStateView = {
  id: string;
  type: "text" | "image" | "video" | "story";
  status: "draft" | "scheduled" | "publishing" | "posted" | "failed";
  publishAt: string | null;
  publishedAt: string | null;
  targets: PublishingTargetView[];
};

export const TERMINAL_POST_STATUS = ["posted", "failed"] as const;

export function isTerminal(status: PublishingStateView["status"]): boolean {
  return status === "posted" || status === "failed";
}

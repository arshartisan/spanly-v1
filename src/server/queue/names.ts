/**
 * Queue names + job payload types. Kept free of imports so both the Next.js app
 * (via the aliased queue module) and the standalone worker can import it cleanly.
 */
export const QUEUE_NAMES = {
  publish: "publish",
  media: "media",
  maintenance: "maintenance",
} as const;

export interface PublishJobData {
  targetId: string;
}

export interface MediaJobData {
  mediaId: string;
}

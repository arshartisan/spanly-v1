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

export type MaintenanceTask = "missed-run-sweep" | "drafts-cleanup" | "token-refresh-sweep";

export interface MaintenanceJobData {
  task: MaintenanceTask;
}

// Stable repeatable-job ids so re-registering on every worker boot doesn't duplicate them.
export const REPEATABLE_JOB_IDS = {
  missedRunSweep: "repeat:missed-run-sweep",
  draftsCleanup: "repeat:drafts-cleanup",
  tokenRefreshSweep: "repeat:token-refresh-sweep",
} as const;

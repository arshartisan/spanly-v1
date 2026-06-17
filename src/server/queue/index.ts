/**
 * BullMQ queues (docs/implementation/08). The Next.js app ENQUEUES publish jobs here; the
 * standalone worker (worker/index.ts) consumes them and the maintenance queue. No
 * `server-only` import - the worker (plain tsx process) imports this module too.
 */
import { Queue } from "bullmq";
import { redis } from "@/server/redis";
import {
  QUEUE_NAMES,
  type MaintenanceJobData,
  type PublishJobData,
} from "@/server/queue/names";

export { QUEUE_NAMES };
export type { PublishJobData, MaintenanceJobData };

export const publishQueue = new Queue<PublishJobData>(QUEUE_NAMES.publish, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const maintenanceQueue = new Queue<MaintenanceJobData>(QUEUE_NAMES.maintenance, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
});

export interface PublishEnqueue {
  targetId: string;
  delayMs: number;
}

// BullMQ forbids ":" in a custom jobId, so we key off the colon-free PostTarget.id
// (1:1 with the target, so duplicate enqueues still collapse - exactly-once preserved).
const jobIdFor = (targetId: string) => `publish-${targetId}`;

/**
 * Add one delayed publish job per target, keyed by a stable jobId.
 *
 * BullMQ dedups by jobId across ALL states - including completed/failed. A finished job left
 * in the queue would therefore silently swallow every later re-enqueue (Retry button, the
 * missed-run sweep), leaving the target stuck "pending" forever. So we remove any prior job
 * with this id before re-adding. publishTarget is itself idempotent (it early-returns on a
 * target already "success"), so a removed-then-readded job never double-posts.
 */
export async function enqueuePublish(jobs: PublishEnqueue[]): Promise<void> {
  if (jobs.length === 0) return;
  await Promise.all(
    jobs.map(async (j) => {
      const jobId = jobIdFor(j.targetId);
      // No-op if it doesn't exist; ignore the rare race where it's mid-removal/active.
      await publishQueue.remove(jobId).catch(() => undefined);
      await publishQueue.add(
        "publish",
        { targetId: j.targetId },
        { jobId, delay: Math.max(0, Math.floor(j.delayMs)) },
      );
    }),
  );
}

/**
 * Remove the queued publish job for each target (admin cancel/takedown, doc 18). Mirrors
 * `enqueuePublish`: keyed by the same `jobIdFor`, Promise.all, swallows not-found so a job
 * that already completed/never existed is a no-op. Callers go through this helper rather
 * than importing bullmq, keeping the worker process boundary clean.
 */
export async function removePublishJobs(targetIds: string[]): Promise<void> {
  if (targetIds.length === 0) return;
  await Promise.all(
    targetIds.map((id) => publishQueue.remove(jobIdFor(id)).catch(() => undefined)),
  );
}

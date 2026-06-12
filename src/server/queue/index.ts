/**
 * BullMQ queues (docs/implementation/08). The Next.js app ENQUEUES publish jobs here; the
 * standalone worker (worker/index.ts) consumes them and the maintenance queue. No
 * `server-only` import — the worker (plain tsx process) imports this module too.
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
// (1:1 with the target, so duplicate enqueues still collapse — exactly-once preserved).
const jobIdFor = (targetId: string) => `publish-${targetId}`;

/** Add one delayed publish job per target. Idempotent via jobId. */
export async function enqueuePublish(jobs: PublishEnqueue[]): Promise<void> {
  if (jobs.length === 0) return;
  await Promise.all(
    jobs.map((j) =>
      publishQueue.add(
        "publish",
        { targetId: j.targetId },
        { jobId: jobIdFor(j.targetId), delay: Math.max(0, Math.floor(j.delayMs)) },
      ),
    ),
  );
}

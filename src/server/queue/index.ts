/**
 * BullMQ queues (docs/implementation/08). The Next.js app ENQUEUES jobs here; the
 * standalone worker (worker/index.ts) consumes them. Full publish/retry/missed-run logic
 * arrives in Phase 5 — Phase 1 only establishes the queues + connection.
 */
import { Queue } from "bullmq";
import { redis } from "@/server/redis";
import { QUEUE_NAMES, type PublishJobData } from "@/server/queue/names";

export { QUEUE_NAMES };
export type { PublishJobData };

export const publishQueue = new Queue<PublishJobData>(QUEUE_NAMES.publish, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

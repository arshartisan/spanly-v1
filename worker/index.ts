/**
 * Spanly scheduler worker (docs/implementation/00 + 08). Runs as a SEPARATE always-on
 * process (not serverless). Consumes:
 *   • publishQueue     — one job per PostTarget → provider.publish (retry/backoff/rollup).
 *   • maintenanceQueue — repeatable sweeps: missed-run recovery, drafts cleanup, token refresh.
 */
import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import {
  QUEUE_NAMES,
  REPEATABLE_JOB_IDS,
  type MaintenanceJobData,
  type PublishJobData,
} from "../src/server/queue/names";
import { maintenanceQueue } from "../src/server/queue";
import { publishTarget } from "../src/server/publish-runner";
import { cleanupOldDrafts, sweepMissedRuns, sweepTokenRefresh } from "../src/server/maintenance";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─────────────────────────── Publish worker ───────────────────────────
const publishWorker = new Worker<PublishJobData>(
  QUEUE_NAMES.publish,
  async (job) => {
    await publishTarget(job.data.targetId);
  },
  { connection, concurrency: 5 },
);

publishWorker.on("ready", () =>
  console.log(`[worker] ready — listening on "${QUEUE_NAMES.publish}" queue`),
);
publishWorker.on("completed", (job) => console.log(`[worker] publish ${job.id} done`));
publishWorker.on("failed", (job, err) =>
  console.error(`[worker] publish ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message),
);
publishWorker.on("error", (err) => console.error("[worker] publish error:", err.message));

// ─────────────────────────── Maintenance worker ───────────────────────────
const maintenanceWorker = new Worker<MaintenanceJobData>(
  QUEUE_NAMES.maintenance,
  async (job) => {
    switch (job.data.task) {
      case "missed-run-sweep": {
        const n = await sweepMissedRuns();
        if (n > 0) console.log(`[worker] missed-run sweep re-enqueued ${n} target(s)`);
        return;
      }
      case "drafts-cleanup": {
        const n = await cleanupOldDrafts();
        if (n > 0) console.log(`[worker] drafts cleanup removed ${n} old draft(s)`);
        return;
      }
      case "token-refresh-sweep": {
        const n = await sweepTokenRefresh();
        if (n > 0) console.log(`[worker] ${n} account token(s) expiring soon`);
        return;
      }
    }
  },
  { connection, concurrency: 1 },
);
maintenanceWorker.on("error", (err) => console.error("[worker] maintenance error:", err.message));

// Register repeatable sweeps (idempotent via stable jobId).
async function registerRepeatables() {
  await maintenanceQueue.add(
    "missed-run-sweep",
    { task: "missed-run-sweep" },
    { jobId: REPEATABLE_JOB_IDS.missedRunSweep, repeat: { every: 60_000 } },
  );
  await maintenanceQueue.add(
    "drafts-cleanup",
    { task: "drafts-cleanup" },
    { jobId: REPEATABLE_JOB_IDS.draftsCleanup, repeat: { pattern: "0 3 * * *" } }, // daily 03:00
  );
  await maintenanceQueue.add(
    "token-refresh-sweep",
    { task: "token-refresh-sweep" },
    { jobId: REPEATABLE_JOB_IDS.tokenRefreshSweep, repeat: { every: 30 * 60_000 } },
  );
}

async function shutdown() {
  console.log("[worker] shutting down…");
  await publishWorker.close();
  await maintenanceWorker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] starting…");
registerRepeatables()
  .then(() => console.log("[worker] repeatable maintenance jobs registered"))
  .catch((err) => console.error("[worker] failed to register repeatables:", err.message));

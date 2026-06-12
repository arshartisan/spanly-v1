/**
 * Spanly scheduler worker (docs/implementation/00 + 08). Runs as a SEPARATE always-on
 * process (not serverless). Phase 1: boots, connects to Redis, and registers a placeholder
 * publish processor. The real provider.publish + status rollup + retry land in Phase 5/6.
 */
import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, type PublishJobData } from "../src/server/queue/names";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker<PublishJobData>(
  QUEUE_NAMES.publish,
  async (job) => {
    // Phase 5/6 will: load PostTarget, decrypt tokens, call provider.publish(),
    // update target status, and roll up the parent Post status.
    console.log(`[worker] received publish job ${job.id} →`, job.data);
    return { ok: true, placeholder: true };
  },
  { connection, concurrency: 5 },
);

worker.on("ready", () => {
  console.log(`[worker] ready — listening on "${QUEUE_NAMES.publish}" queue`);
});
worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});
worker.on("error", (err) => {
  console.error("[worker] error:", err.message);
});

async function shutdown() {
  console.log("[worker] shutting down…");
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] starting…");

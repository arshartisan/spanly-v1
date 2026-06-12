/**
 * Maintenance jobs (docs/implementation/07 + 08), run by the worker on a repeatable schedule.
 * No `server-only` import — this executes in the standalone worker process.
 */
import { prisma } from "@/server/db";
import { enqueuePublish } from "@/server/queue";

const DRAFT_TTL_DAYS = 90;

/**
 * Re-enqueue publish jobs for due posts whose targets never ran (e.g. Redis was down at
 * schedule time). Dedup via jobId means this is safe to run repeatedly. Returns job count.
 */
export async function sweepMissedRuns(now = new Date()): Promise<number> {
  const due = await prisma.post.findMany({
    where: {
      status: { in: ["scheduled", "publishing"] },
      publishAt: { lte: now },
    },
    include: { targets: { where: { status: "pending" } } },
  });

  const jobs = due.flatMap((post) =>
    post.targets.map((t) => ({ targetId: t.id, delayMs: 0 })),
  );
  await enqueuePublish(jobs);
  return jobs.length;
}

/** Delete drafts older than 90 days (design doc 07). Returns deleted count. */
export async function cleanupOldDrafts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  const res = await prisma.post.deleteMany({
    where: { status: "draft", createdAt: { lt: cutoff } },
  });
  return res.count;
}

/**
 * Refresh tokens that expire within the next 24h so publishing never races an expiry.
 * Mock refresh just pushes the expiry out; real providers hit their token endpoint.
 */
export async function sweepTokenRefresh(now = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const accounts = await prisma.socialAccount.findMany({
    where: { disconnectedAt: null, status: "active", tokenExpiresAt: { lte: soon } },
  });
  // Actual refresh runs lazily in publishTarget; here we only surface the count for logging.
  return accounts.length;
}

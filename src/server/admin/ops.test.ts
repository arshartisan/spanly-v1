import { beforeEach, describe, expect, it, vi } from "vitest";

// ops.ts imports "server-only" (a Next build alias, not a real module in a plain vitest
// run). Stub it. We mock @/server/db (prisma), @/server/redis (the ioredis client), the
// BullMQ producer clients in @/server/queue, and the bare `bullmq` Queue constructor — so
// the unit under test never touches a real Redis/DB. Every queue handle is a plain spy.
vi.mock("server-only", () => ({}));

// All spies live in a single vi.hoisted() block so the (hoisted) vi.mock factories below
// can safely reference them — top-level `const`s would not be initialized yet when the
// hoisted factories run. One bag of spies per queue. publish + maintenance come from
// @/server/queue; the `media` queue is built lazily inside ops.ts via `new Queue(...)`, so
// we also mock the bare `bullmq` constructor to return the same media spy bag. Every code
// path (counts, listJobs, getJob, add) is driveable without a real Redis/DB.
const h = vi.hoisted(() => {
  const makeQueueSpies = () => ({
    getJobCounts: vi.fn(),
    getJobs: vi.fn(),
    getJob: vi.fn(),
    add: vi.fn(),
  });
  return {
    queryRaw: vi.fn(),
    webhookEventFindMany: vi.fn(),
    postTargetFindMany: vi.fn(),
    redisPing: vi.fn(),
    publishSpies: makeQueueSpies(),
    maintenanceSpies: makeQueueSpies(),
    mediaSpies: makeQueueSpies(),
  };
});
const { queryRaw, redisPing, publishSpies, maintenanceSpies, mediaSpies } = h;

// ─────────────────────────── Prisma mock ───────────────────────────
vi.mock("@/server/db", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
    webhookEvent: { findMany: (a: unknown) => h.webhookEventFindMany(a) },
    postTarget: { findMany: (a: unknown) => h.postTargetFindMany(a) },
  },
}));

// ─────────────────────────── Redis mock ───────────────────────────
// Only `ping` is exercised by getSystemHealth; the queue mocks carry their own spies.
vi.mock("@/server/redis", () => ({
  redis: { ping: () => h.redisPing() },
}));

// ─────────────────────────── Queue mocks ───────────────────────────
vi.mock("@/server/queue", () => ({
  publishQueue: h.publishSpies,
  maintenanceQueue: h.maintenanceSpies,
}));

// `new Queue(QUEUE_NAMES.media, ...)` inside ops.ts → return the media spy bag.
vi.mock("bullmq", () => ({
  Queue: vi.fn(() => h.mediaSpies),
}));

// Imported after the mocks above are registered.
import {
  classifyError,
  summarizeFailedTargets,
  buildWebhookEventWhere,
  getSystemHealth,
  getQueueCounts,
  listJobs,
  retryJob,
  removeJob,
  runMaintenance,
  AdminActionError,
} from "./ops";
import {
  jobListQuerySchema,
  maintenanceTaskSchema,
  webhookEventQuerySchema,
} from "@/lib/schemas/admin-ops";
import { QUEUE_NAMES, REPEATABLE_JOB_IDS } from "@/server/queue/names";

beforeEach(() => {
  queryRaw.mockReset();
  h.webhookEventFindMany.mockReset();
  h.postTargetFindMany.mockReset();
  redisPing.mockReset();
  for (const s of [publishSpies, maintenanceSpies, mediaSpies]) {
    s.getJobCounts.mockReset();
    s.getJobs.mockReset();
    s.getJob.mockReset();
    s.add.mockReset();
  }
});

/** Run `fn`, returning the thrown value (or throwing if it unexpectedly resolves). */
async function catchThrown<T>(fn: () => Promise<T>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, but it resolved");
}

const FULL_COUNTS = {
  active: 1,
  waiting: 2,
  delayed: 3,
  completed: 4,
  failed: 5,
  paused: 6,
};

/** Resolve every queue's getJobCounts to the same healthy count object. */
function allQueuesHealthy() {
  for (const s of [publishSpies, maintenanceSpies, mediaSpies]) {
    s.getJobCounts.mockResolvedValue({ ...FULL_COUNTS });
  }
}

// ═══════════════════════════ PURE: classifyError ═══════════════════════════
// Acceptance: failed jobs grouped by error class — this is the per-error normalizer.

describe("classifyError (pure → coarse error class)", () => {
  it("null → 'Unknown' (the impl's sentinel)", () => {
    expect(classifyError(null)).toBe("Unknown");
  });

  it("empty / whitespace-only string → 'Unknown'", () => {
    expect(classifyError("")).toBe("Unknown");
    expect(classifyError("   ")).toBe("Unknown");
  });

  it("a known provider error prefix → that first sentence as its class", () => {
    expect(classifyError("Instagram token expired. Reconnect the account.")).toBe(
      "Instagram token expired.",
    );
  });

  it("multi-line error → only the first line is the class", () => {
    expect(classifyError("Rate limited by provider\n  at publishTarget (x.ts:10)")).toBe(
      "Rate limited by provider",
    );
  });

  it("an arbitrary long single-line string with no sentence break → returned trimmed whole", () => {
    const long = " " + "x".repeat(300) + " ";
    expect(classifyError(long)).toBe("x".repeat(300));
  });

  it("deterministic: same input → same output", () => {
    const input = "TikTok upload failed. retry later";
    expect(classifyError(input)).toBe(classifyError(input));
  });
});

// ═══════════════════════════ PURE: summarizeFailedTargets ═══════════════════════════
// Acceptance: "failed jobs grouped by platform + error class."

describe("summarizeFailedTargets (pure → grouped by platform+errorClass)", () => {
  it("empty rows → { groups: [], total: 0 }", () => {
    expect(summarizeFailedTargets([])).toEqual({ groups: [], total: 0 });
  });

  it("two targets, same platform + same error → one group with count 2", () => {
    const result = summarizeFailedTargets([
      { platform: "instagram", error: "Token expired." },
      { platform: "instagram", error: "Token expired." },
    ]);
    expect(result.total).toBe(2);
    expect(result.groups).toEqual([
      { platform: "instagram", errorClass: "Token expired.", count: 2 },
    ]);
  });

  it("same platform but different errors → separate groups", () => {
    const result = summarizeFailedTargets([
      { platform: "instagram", error: "Token expired." },
      { platform: "instagram", error: "Rate limited." },
    ]);
    expect(result.total).toBe(2);
    expect(result.groups).toHaveLength(2);
    expect(result.groups).toContainEqual({
      platform: "instagram",
      errorClass: "Token expired.",
      count: 1,
    });
    expect(result.groups).toContainEqual({
      platform: "instagram",
      errorClass: "Rate limited.",
      count: 1,
    });
  });

  it("same error string but different platforms → separate groups", () => {
    const result = summarizeFailedTargets([
      { platform: "instagram", error: "Token expired." },
      { platform: "tiktok", error: "Token expired." },
    ]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((g) => g.platform).sort()).toEqual(["instagram", "tiktok"]);
  });

  it("null errors collapse into a single 'Unknown' class per platform", () => {
    const result = summarizeFailedTargets([
      { platform: "x", error: null },
      { platform: "x", error: null },
    ]);
    expect(result.groups).toEqual([{ platform: "x", errorClass: "Unknown", count: 2 }]);
  });

  it("total always equals the sum of all group counts", () => {
    const rows = [
      { platform: "instagram", error: "A." },
      { platform: "instagram", error: "A." },
      { platform: "tiktok", error: "B." },
      { platform: "youtube", error: null },
    ];
    const result = summarizeFailedTargets(rows);
    expect(result.total).toBe(rows.length);
    const summed = result.groups.reduce((acc, g) => acc + g.count, 0);
    expect(summed).toBe(result.total);
  });

  it("groups are ordered by descending count (largest outage first)", () => {
    const result = summarizeFailedTargets([
      { platform: "tiktok", error: "B." },
      { platform: "instagram", error: "A." },
      { platform: "instagram", error: "A." },
    ]);
    expect(result.groups[0]).toEqual({
      platform: "instagram",
      errorClass: "A.",
      count: 2,
    });
  });
});

// ═══════════════════════════ PURE: buildWebhookEventWhere ═══════════════════════════

describe("buildWebhookEventWhere (pure → Prisma.WebhookEventWhereInput)", () => {
  it("no source → {} (no constraints)", () => {
    expect(buildWebhookEventWhere({})).toEqual({});
  });

  it("source set → { source }", () => {
    expect(buildWebhookEventWhere({ source: "paypal" })).toEqual({ source: "paypal" });
  });

  it("empty-string source is falsy → omitted", () => {
    expect(buildWebhookEventWhere({ source: "" })).toEqual({});
  });
});

// ═══════════════════════════ getSystemHealth (mock prisma + redis) ═══════════════════════════
// Acceptance: "Health tiles flip red when a dependency is down." + degrade, never throw.

describe("getSystemHealth (defensive — degrades, never throws)", () => {
  it("db ok + redis ok → healthy:true, both 'ok', latencyMs is a number ≥ 0", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redisPing.mockResolvedValue("PONG");

    const health = await getSystemHealth();

    expect(health.healthy).toBe(true);
    expect(health.db.status).toBe("ok");
    expect(health.redis.status).toBe("ok");
    expect(typeof health.db.latencyMs).toBe("number");
    expect(health.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("redis.ping throws → redis 'error', healthy:false, NO throw (page-safe)", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    redisPing.mockRejectedValue(new Error("ECONNREFUSED"));

    const health = await getSystemHealth();

    expect(health.redis.status).toBe("error");
    expect(health.db.status).toBe("ok");
    expect(health.healthy).toBe(false);
  });

  it("redis.ping resolves a non-PONG value → treated as error", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    redisPing.mockResolvedValue("WRONG");

    const health = await getSystemHealth();
    expect(health.redis.status).toBe("error");
    expect(health.healthy).toBe(false);
  });

  it("db $queryRaw throws → db 'error', healthy:false", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    redisPing.mockResolvedValue("PONG");

    const health = await getSystemHealth();
    expect(health.db.status).toBe("error");
    expect(health.redis.status).toBe("ok");
    expect(health.healthy).toBe(false);
  });

  it("BOTH deps down → never throws, healthy:false, both 'error'", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    redisPing.mockRejectedValue(new Error("redis down"));

    const health = await getSystemHealth();
    expect(health.healthy).toBe(false);
    expect(health.db.status).toBe("error");
    expect(health.redis.status).toBe("error");
  });

  it("surfaces providerMode / billingMode (default 'mock')", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    redisPing.mockResolvedValue("PONG");
    const health = await getSystemHealth();
    expect(typeof health.providerMode).toBe("string");
    expect(typeof health.billingMode).toBe("string");
  });
});

// ═══════════════════════════ getQueueCounts (mock queues + redis) ═══════════════════════════
// Edge case: "handle Redis-down gracefully" — degrade per queue, never throw.

describe("getQueueCounts (defensive per-queue counts)", () => {
  it("all queues return counts → redisOk:true, each entry has populated counts", async () => {
    allQueuesHealthy();

    const result = await getQueueCounts();

    expect(result.redisOk).toBe(true);
    expect(result.queues).toHaveLength(3);
    for (const entry of result.queues) {
      expect(entry.counts).toEqual(FULL_COUNTS);
      expect(entry.error).toBeUndefined();
    }
    // All three queue names are represented.
    expect(result.queues.map((q) => q.name).sort()).toEqual(
      [QUEUE_NAMES.maintenance, QUEUE_NAMES.media, QUEUE_NAMES.publish].sort(),
    );
  });

  it("missing count fields default to 0", async () => {
    for (const s of [publishSpies, maintenanceSpies, mediaSpies]) {
      s.getJobCounts.mockResolvedValue({ active: 7 }); // only one field present
    }
    const result = await getQueueCounts();
    expect(result.redisOk).toBe(true);
    expect(result.queues[0].counts).toEqual({
      active: 7,
      waiting: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      paused: 0,
    });
  });

  it("one queue's getJobCounts throws (Redis down) → that entry counts:null + error, redisOk:false, NO throw", async () => {
    publishSpies.getJobCounts.mockResolvedValue({ ...FULL_COUNTS });
    mediaSpies.getJobCounts.mockResolvedValue({ ...FULL_COUNTS });
    maintenanceSpies.getJobCounts.mockRejectedValue(new Error("Connection is closed."));

    const result = await getQueueCounts();

    expect(result.redisOk).toBe(false);
    const broken = result.queues.find((q) => q.name === QUEUE_NAMES.maintenance);
    expect(broken?.counts).toBeNull();
    expect(broken?.error).toBe("Connection is closed.");
    // Healthy queues still report counts.
    const ok = result.queues.find((q) => q.name === QUEUE_NAMES.publish);
    expect(ok?.counts).toEqual(FULL_COUNTS);
  });

  it("ALL queues down → redisOk:false, all counts null, still resolves (never throws)", async () => {
    for (const s of [publishSpies, maintenanceSpies, mediaSpies]) {
      s.getJobCounts.mockRejectedValue(new Error("down"));
    }
    const result = await getQueueCounts();
    expect(result.redisOk).toBe(false);
    expect(result.queues.every((q) => q.counts === null)).toBe(true);
  });
});

// ═══════════════════════════ listJobs (mock queues) ═══════════════════════════

describe("listJobs (guards + SAFE DTO mapping)", () => {
  it("unknown queue → AdminActionError(400)", async () => {
    const err = await catchThrown(() => listJobs({ queue: "bogus" }));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(400);
  });

  it("Redis down (getJobs throws) → AdminActionError(503)", async () => {
    publishSpies.getJobs.mockRejectedValue(new Error("Connection is closed."));
    const err = await catchThrown(() => listJobs({ queue: QUEUE_NAMES.publish }));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(503);
  });

  it("defaults state to 'failed' and returns it in the result", async () => {
    publishSpies.getJobs.mockResolvedValue([]);
    const result = await listJobs({ queue: QUEUE_NAMES.publish });
    expect(result.state).toBe("failed");
    expect(result.queue).toBe(QUEUE_NAMES.publish);
    // BullMQ getJobs called with the [state] type, offset 0, limit 100.
    expect(publishSpies.getJobs).toHaveBeenCalledWith(["failed"], 0, 100);
  });

  it("maps a job to the SAFE DTO shape and does NOT leak secret/token fields", async () => {
    publishSpies.getJobs.mockResolvedValue([
      {
        id: "job_1",
        name: "publish",
        attemptsMade: 2,
        timestamp: 1000,
        processedOn: 1100,
        finishedOn: 1200,
        failedReason: "Token expired.",
        // A hostile payload: only targetId/task should survive; the rest must be dropped.
        data: {
          targetId: "t_1",
          task: "publish",
          encryptedTokens: "SECRET_TOKEN",
          accessToken: "AT_LEAK",
          refreshToken: "RT_LEAK",
        },
      },
    ]);

    const result = await listJobs({ queue: QUEUE_NAMES.publish, state: "failed" });

    expect(result.jobs).toHaveLength(1);
    const dto = result.jobs[0];
    // Explicit DTO shape: exactly these keys, nothing more.
    expect(Object.keys(dto).sort()).toEqual(
      [
        "attemptsMade",
        "data",
        "failedReason",
        "finishedOn",
        "id",
        "name",
        "processedOn",
        "timestamp",
      ].sort(),
    );
    expect(dto.data).toEqual({ targetId: "t_1", task: "publish" });
    // No secret leaked anywhere in the serialized DTO.
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("SECRET_TOKEN");
    expect(serialized).not.toContain("AT_LEAK");
    expect(serialized).not.toContain("RT_LEAK");
    expect(serialized).not.toContain("encryptedTokens");
    expect(serialized).not.toContain("accessToken");
  });

  it("null/missing optional job fields normalize (id→null, reason→null, data→{})", async () => {
    publishSpies.getJobs.mockResolvedValue([
      {
        id: undefined,
        name: "publish",
        attemptsMade: 0,
        timestamp: 500,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: "",
        data: undefined,
      },
    ]);
    const result = await listJobs({ queue: QUEUE_NAMES.publish });
    const dto = result.jobs[0];
    expect(dto.id).toBeNull();
    expect(dto.processedOn).toBeNull();
    expect(dto.finishedOn).toBeNull();
    expect(dto.failedReason).toBeNull();
    expect(dto.data).toEqual({});
  });

  it("non-string targetId/task in payload are dropped from data", async () => {
    publishSpies.getJobs.mockResolvedValue([
      {
        id: "j",
        name: "publish",
        attemptsMade: 0,
        timestamp: 1,
        data: { targetId: 12345, task: { nested: true } },
      },
    ]);
    const result = await listJobs({ queue: QUEUE_NAMES.publish });
    expect(result.jobs[0].data).toEqual({});
  });
});

// ═══════════════════════════ retryJob / removeJob (mock getJob) ═══════════════════════════

describe("retryJob", () => {
  it("unknown queue → AdminActionError(400), never loads a job", async () => {
    const err = await catchThrown(() => retryJob("bogus", "job_1"));
    expect((err as AdminActionError).status).toBe(400);
    expect(publishSpies.getJob).not.toHaveBeenCalled();
  });

  it("job missing → AdminActionError(404)", async () => {
    publishSpies.getJob.mockResolvedValue(undefined);
    const err = await catchThrown(() => retryJob(QUEUE_NAMES.publish, "job_x"));
    expect((err as AdminActionError).status).toBe(404);
  });

  it("present → calls job.retry() and returns { id }", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    publishSpies.getJob.mockResolvedValue({ id: "job_1", retry });
    const result = await retryJob(QUEUE_NAMES.publish, "job_1");
    expect(retry).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "job_1" });
  });
});

describe("removeJob", () => {
  it("unknown queue → AdminActionError(400)", async () => {
    const err = await catchThrown(() => removeJob("bogus", "job_1"));
    expect((err as AdminActionError).status).toBe(400);
  });

  it("job missing → AdminActionError(404)", async () => {
    publishSpies.getJob.mockResolvedValue(null);
    const err = await catchThrown(() => removeJob(QUEUE_NAMES.publish, "job_x"));
    expect((err as AdminActionError).status).toBe(404);
  });

  it("present → calls job.remove() and returns { id }", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    publishSpies.getJob.mockResolvedValue({ id: "job_1", remove });
    const result = await removeJob(QUEUE_NAMES.publish, "job_1");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "job_1" });
  });
});

// ═══════════════════════════ runMaintenance ═══════════════════════════
// Edge case: triggering a sweep is safe/repeatable — uses a UNIQUE manual jobId, not the
// repeatable id, so it can never dedup against the scheduled repeatable.

describe("runMaintenance", () => {
  it("invalid task → AdminActionError(400), never enqueues", async () => {
    const err = await catchThrown(() => runMaintenance("delete-everything"));
    expect((err as AdminActionError).status).toBe(400);
    expect(maintenanceSpies.add).not.toHaveBeenCalled();
  });

  it.each([
    "missed-run-sweep",
    "drafts-cleanup",
    "token-refresh-sweep",
  ] as const)("valid task '%s' → enqueues { task } and returns enqueued", async (task) => {
    maintenanceSpies.add.mockResolvedValue({ id: "manual-x" });

    const result = await runMaintenance(task);

    expect(result).toEqual({ task, enqueued: true });
    expect(maintenanceSpies.add).toHaveBeenCalledTimes(1);
    const [jobName, payload, opts] = maintenanceSpies.add.mock.calls[0] as [
      string,
      { task: string },
      { jobId: string },
    ];
    expect(jobName).toBe(task);
    expect(payload).toEqual({ task });
    // The manual jobId must NOT collide with any scheduled repeatable jobId.
    const repeatableIds = Object.values(REPEATABLE_JOB_IDS);
    expect(repeatableIds).not.toContain(opts.jobId);
    expect(opts.jobId).toContain(task);
  });

  it("two manual runs of the same task get distinct jobIds (no dedup)", async () => {
    maintenanceSpies.add.mockResolvedValue({});
    // Date.now()-keyed jobId — drive the clock so the two ids are guaranteed distinct.
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    await runMaintenance("drafts-cleanup");
    await runMaintenance("drafts-cleanup");

    const id1 = (maintenanceSpies.add.mock.calls[0][2] as { jobId: string }).jobId;
    const id2 = (maintenanceSpies.add.mock.calls[1][2] as { jobId: string }).jobId;
    expect(id1).not.toBe(id2);
    nowSpy.mockRestore();
  });

  it("Redis down (add throws) → AdminActionError(503)", async () => {
    maintenanceSpies.add.mockRejectedValue(new Error("Connection is closed."));
    const err = await catchThrown(() => runMaintenance("drafts-cleanup"));
    expect((err as AdminActionError).status).toBe(503);
  });
});

// ═══════════════════════════ Zod: jobListQuerySchema ═══════════════════════════

describe("jobListQuerySchema", () => {
  it("accepts a valid queue + state", () => {
    const parsed = jobListQuerySchema.parse({ queue: "publish", state: "active" });
    expect(parsed.queue).toBe("publish");
    expect(parsed.state).toBe("active");
  });

  it("state defaults to 'failed' when omitted", () => {
    expect(jobListQuerySchema.parse({ queue: "media" }).state).toBe("failed");
  });

  it("rejects an unknown queue enum", () => {
    expect(jobListQuerySchema.safeParse({ queue: "bogus" }).success).toBe(false);
  });

  it("rejects an unknown state enum", () => {
    expect(jobListQuerySchema.safeParse({ queue: "publish", state: "boom" }).success).toBe(
      false,
    );
  });

  it("requires queue (no default)", () => {
    expect(jobListQuerySchema.safeParse({}).success).toBe(false);
  });
});

// ═══════════════════════════ Zod: maintenanceTaskSchema ═══════════════════════════

describe("maintenanceTaskSchema", () => {
  it.each([
    "missed-run-sweep",
    "drafts-cleanup",
    "token-refresh-sweep",
  ])("accepts the valid task '%s'", (task) => {
    expect(maintenanceTaskSchema.parse(task)).toBe(task);
  });

  it("rejects a junk task", () => {
    expect(maintenanceTaskSchema.safeParse("rm-rf").success).toBe(false);
    expect(maintenanceTaskSchema.safeParse("").success).toBe(false);
    expect(maintenanceTaskSchema.safeParse(undefined).success).toBe(false);
  });
});

// ═══════════════════════════ Zod: webhookEventQuerySchema ═══════════════════════════

describe("webhookEventQuerySchema", () => {
  it("source is optional (empty object parses)", () => {
    const parsed = webhookEventQuerySchema.parse({});
    expect(parsed.source).toBeUndefined();
    expect(parsed.cursor).toBeUndefined();
  });

  it("take defaults to 25 and coerces a string take", () => {
    expect(webhookEventQuerySchema.parse({}).take).toBe(25);
    expect(webhookEventQuerySchema.parse({ take: "10" }).take).toBe(10);
  });

  it("clamps take to the [1, 100] range (rejects 0 and 101)", () => {
    expect(webhookEventQuerySchema.safeParse({ take: "0" }).success).toBe(false);
    expect(webhookEventQuerySchema.safeParse({ take: "101" }).success).toBe(false);
    expect(webhookEventQuerySchema.parse({ take: "100" }).take).toBe(100);
  });

  it("trims source and rejects a blank one", () => {
    expect(webhookEventQuerySchema.parse({ source: "  paypal  " }).source).toBe("paypal");
    expect(webhookEventQuerySchema.safeParse({ source: "   " }).success).toBe(false);
  });

  it("accepts a real source + cursor", () => {
    const parsed = webhookEventQuerySchema.parse({ source: "paypal", cursor: "evt_1" });
    expect(parsed.source).toBe("paypal");
    expect(parsed.cursor).toBe("evt_1");
  });

  it("rejects an empty cursor (consistent with min(1))", () => {
    expect(webhookEventQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });
});

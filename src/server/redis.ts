import IORedis from "ioredis";

// Shared Redis connection for BullMQ (queues + worker). BullMQ requires
// maxRetriesPerRequest: null. lazyConnect avoids connecting at import time
// (e.g. during `next build`), and an error handler prevents unhandled 'error'
// events from crashing the process when Redis is briefly unavailable.
const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

redis.on("error", (err) => {
  // Avoid noisy unhandled error events; real failures surface at command call sites.
  if (process.env.NODE_ENV === "development") {
    console.warn("[redis] connection error:", (err as Error).message);
  }
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

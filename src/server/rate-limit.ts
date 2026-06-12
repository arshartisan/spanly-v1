import { redis } from "@/server/redis";

/**
 * Fixed-window rate limiter backed by Redis (doc 03: deter brute-force on /login, /forgot).
 * Fails open: if Redis is unavailable we allow the request rather than lock users out.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    const ttl = await redis.ttl(redisKey);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl >= 0 ? ttl : windowSeconds,
    };
  } catch {
    // Fail open — never block auth on a Redis hiccup.
    return { ok: true, remaining: limit, resetSeconds: windowSeconds };
  }
}

/** Best-effort client IP from standard proxy headers; falls back to a constant bucket. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

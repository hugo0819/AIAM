import type { RateLimit } from "@/types/passport";

/**
 * 进程内滑动窗口令牌桶，针对 passportId 维度。
 * 演示足够，生产请用 Redis。
 */
class RateLimiter {
  private buckets = new Map<string, number[]>();

  tryConsume(passportId: string, limit: RateLimit): { ok: boolean; remaining: number; resetMs: number } {
    const windowMs =
      limit.per === "minute" ? 60_000 : limit.per === "hour" ? 3600_000 : 86_400_000;
    const now = Date.now();
    const cutoff = now - windowMs;
    const key = `${passportId}:${limit.per}`;
    const arr = (this.buckets.get(key) ?? []).filter((t) => t >= cutoff);
    if (arr.length >= limit.count) {
      return { ok: false, remaining: 0, resetMs: arr[0] + windowMs - now };
    }
    arr.push(now);
    this.buckets.set(key, arr);
    return { ok: true, remaining: limit.count - arr.length, resetMs: windowMs };
  }

  reset(passportId: string) {
    const prefix = passportId + ":";
    const keys = Array.from(this.buckets.keys()).filter((k) => k.startsWith(prefix));
    for (const k of keys) this.buckets.delete(k);
  }
}

const g = globalThis as unknown as { __rateLimiter?: RateLimiter };
export const rateLimiter = g.__rateLimiter ?? new RateLimiter();
if (process.env.NODE_ENV !== "production") g.__rateLimiter = rateLimiter;

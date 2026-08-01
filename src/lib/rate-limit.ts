/**
 * 輕量記憶體速率限制（單實例／serverless 熱啟動有效）。
 * 正式環境多實例時請改接 Redis／Upstash；此處作為基本防護。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  options?: { limit?: number; windowMs?: number },
): RateLimitResult {
  const limit = options?.limit ?? 20;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: 0,
  };
}

/** 測試用：清空記憶體桶 */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

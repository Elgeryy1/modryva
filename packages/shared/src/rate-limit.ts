/**
 * A tiny in-process token-bucket rate limiter — no external dependency, no
 * Redis. Each key gets a bucket that refills at `refillPerSec` up to `capacity`
 * (the burst). `tryConsume` spends one token and returns false when the bucket
 * is empty. The key map is FIFO-capped so a flood of distinct keys (e.g. spoofed
 * bot usernames) can't grow memory without bound.
 *
 * Note: behind a reverse proxy, per-IP keys collapse to the proxy's IP, so key
 * on something meaningful for the surface (e.g. the managed bot username on the
 * webhook route). For multi-replica deployments, swap this for a Redis-backed
 * limiter so buckets are shared.
 */
export interface RateLimiter {
  /** Spend one token for `key`; returns false when the bucket is exhausted. */
  tryConsume(key: string): boolean;
}

export interface RateLimiterOptions {
  /** Max tokens a bucket holds (the allowed burst). */
  readonly capacity: number;
  /** Steady refill rate, tokens per second. */
  readonly refillPerSec: number;
  /** Hard cap on tracked keys (FIFO-evicted). Defaults to 50_000. */
  readonly maxKeys?: number;
  /** Injectable clock (ms) for tests. */
  readonly now?: () => number;
}

export const createRateLimiter = (opts: RateLimiterOptions): RateLimiter => {
  const maxKeys = opts.maxKeys ?? 50_000;
  const clock = opts.now ?? (() => Date.now());
  const buckets = new Map<string, { tokens: number; at: number }>();

  return {
    tryConsume(key: string): boolean {
      const now = clock();
      const bucket = buckets.get(key);
      if (bucket) {
        const refill = ((now - bucket.at) / 1000) * opts.refillPerSec;
        if (refill > 0) {
          bucket.tokens = Math.min(opts.capacity, bucket.tokens + refill);
          bucket.at = now;
        }
        if (bucket.tokens < 1) {
          return false;
        }
        bucket.tokens -= 1;
        return true;
      }
      // New key: evict the oldest if we're at the cap (Map keeps insert order).
      if (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) {
          buckets.delete(oldest);
        }
      }
      buckets.set(key, { tokens: opts.capacity - 1, at: now });
      return true;
    },
  };
};

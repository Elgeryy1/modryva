/**
 * Sliding-window counter used by the antiflood engine. Implementations record a
 * timestamp for a key and return the timestamps still inside the window. The
 * in-memory implementation is the default for tests and single-process runs; the
 * Redis implementation is the production adapter and survives restarts.
 */
export interface FloodCounterStore {
  record(
    key: string,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly number[]>;
  reset(key: string): Promise<void>;
}

export class InMemoryFloodCounter implements FloodCounterStore {
  private readonly buckets = new Map<string, number[]>();

  async record(
    key: string,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly number[]> {
    const windowStart = nowMs - windowSeconds * 1000;
    const existing = (this.buckets.get(key) ?? []).filter(
      (value) => value >= windowStart,
    );
    existing.push(nowMs);
    this.buckets.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

/**
 * Minimal contract of the Redis client we rely on. Kept structural so the
 * adapter does not force ioredis as a dependency of this module.
 */
export interface FloodRedisClient {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  pexpire(key: string, ms: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisFloodCounter implements FloodCounterStore {
  constructor(
    private readonly client: FloodRedisClient,
    private readonly prefix = "antiflood",
  ) {}

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async record(
    key: string,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly number[]> {
    const redisKey = this.buildKey(key);
    const windowStart = nowMs - windowSeconds * 1000;
    await this.client.zremrangebyscore(redisKey, 0, windowStart);
    await this.client.zadd(redisKey, nowMs, `${nowMs}-${Math.trunc(nowMs)}`);
    await this.client.pexpire(redisKey, windowSeconds * 1000 + 1000);
    const members = await this.client.zrange(redisKey, 0, -1);
    return members
      .map((member) => Number.parseInt(member.split("-")[0] ?? "", 10))
      .filter((value) => Number.isFinite(value) && value >= windowStart);
  }

  async reset(key: string): Promise<void> {
    await this.client.del(this.buildKey(key));
  }
}

import type { RaidJoin } from "./raid-signals.js";

/**
 * Sliding-window store of recent join NAMES — the piece `FloodCounterStore`
 * (flood-counter.ts) does not provide. `FloodCounterStore` already tracks
 * join TIMESTAMPS for the antiraid burst signal, but it has no notion of
 * "who" joined, so it cannot back raid-signals' name-similarity detector
 * (`detectRaidSignals` / `raidNameSimilarity`) on its own. This store mirrors
 * `FloodCounterStore`'s exact contract (record/reset, same windowed-bucket
 * semantics) so it composes the same way inside the bot's antiraid handler.
 * Pure in-memory, no I/O — matches `InMemoryFloodCounter`, which is what
 * production currently wires for `FLOOD_COUNTER` (see apps/bot/src/app.module.ts).
 */
export interface RaidJoinNameStore {
  record(
    key: string,
    name: string,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly RaidJoin[]>;
  reset(key: string): Promise<void>;
}

export class InMemoryRaidJoinNameStore implements RaidJoinNameStore {
  private readonly buckets = new Map<string, RaidJoin[]>();

  async record(
    key: string,
    name: string,
    nowMs: number,
    windowSeconds: number,
  ): Promise<readonly RaidJoin[]> {
    const windowStart = nowMs - windowSeconds * 1000;
    const existing = (this.buckets.get(key) ?? []).filter(
      (join) => join.ms >= windowStart,
    );
    existing.push({ name, ms: nowMs });
    this.buckets.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

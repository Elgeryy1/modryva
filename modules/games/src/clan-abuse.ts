/** A mission completion attributed to a clan member. Pure and deterministic. */
export interface ClanCompletion {
  readonly clanId: string;
  readonly userId: number;
  readonly atMs: number;
}

/** Options for detectClanAbuse. */
export interface ClanAbuseOptions {
  readonly windowMs?: number;
  readonly minBurst?: number;
}

/** A flagged clan and its peak burst of completions within the window. */
export interface ClanAbuseResult {
  readonly clanId: string;
  readonly burst: number;
}

const DEFAULT_CLAN_WINDOW_MS = 60000;
const DEFAULT_CLAN_MIN_BURST = 5;

/** Largest count of timestamps falling inside any window of length windowMs. */
const maxBurst = (timestamps: readonly number[], windowMs: number): number => {
  const sorted = [...timestamps].sort((a, b) => a - b);
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end += 1) {
    const endMs = sorted[end] ?? 0;
    while ((sorted[start] ?? 0) < endMs - windowMs) {
      start += 1;
    }
    const count = end - start + 1;
    if (count > best) {
      best = count;
    }
  }
  return best;
};

/**
 * Detects clans farming missions in bursts. For each clan it finds the largest
 * number of completions inside any window of windowMs (default 60s) and flags
 * clans whose burst reaches minBurst (default 5). Results are sorted by burst
 * descending, then clanId ascending. Pure and deterministic.
 */
export const detectClanAbuse = (
  completions: readonly ClanCompletion[],
  options?: ClanAbuseOptions,
): readonly ClanAbuseResult[] => {
  const windowMs = options?.windowMs ?? DEFAULT_CLAN_WINDOW_MS;
  const minBurst = options?.minBurst ?? DEFAULT_CLAN_MIN_BURST;
  const byClan = new Map<string, number[]>();
  for (const completion of completions) {
    const list = byClan.get(completion.clanId);
    if (list === undefined) {
      byClan.set(completion.clanId, [completion.atMs]);
    } else {
      list.push(completion.atMs);
    }
  }
  const results: ClanAbuseResult[] = [];
  for (const [clanId, timestamps] of byClan) {
    const burst = maxBurst(timestamps, windowMs);
    if (burst >= minBurst) {
      results.push({ clanId, burst });
    }
  }
  return results.sort((a, b) => {
    if (b.burst !== a.burst) {
      return b.burst - a.burst;
    }
    return a.clanId < b.clanId ? -1 : a.clanId > b.clanId ? 1 : 0;
  });
};

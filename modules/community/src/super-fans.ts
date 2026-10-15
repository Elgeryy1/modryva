/**
 * A community member with their raw engagement counters for a period.
 * Pure data input; no behavior. Pure and deterministic.
 */
export interface SuperFanMember {
  readonly userId: number;
  readonly messages: number;
  readonly reactions: number;
}

/**
 * Tuning knobs for detectSuperFans. topN caps how many fans are returned
 * (default 5). minScore is the inclusive threshold to qualify (default 20).
 * Pure and deterministic.
 */
export interface SuperFanOptions {
  readonly topN?: number;
  readonly minScore?: number;
}

/**
 * A qualified super fan with the engagement score that ranked them.
 * Pure and deterministic.
 */
export interface SuperFanRank {
  readonly userId: number;
  readonly score: number;
}

const DEFAULT_TOP_N = 5;
const DEFAULT_MIN_SCORE = 20;
const REACTION_WEIGHT = 0.5;

/**
 * Detects the most active community members ("super fans").
 * Score is messages + reactions * 0.5. Members with score >= minScore
 * (default 20) qualify; results are sorted by score descending, ties broken
 * by userId ascending, then truncated to topN (default 5). A non-positive
 * topN yields an empty list. Pure and deterministic.
 */
export const detectSuperFans = (
  members: readonly SuperFanMember[],
  options?: SuperFanOptions,
): readonly SuperFanRank[] => {
  const topN = options?.topN ?? DEFAULT_TOP_N;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const limit = topN > 0 ? topN : 0;

  const ranked: SuperFanRank[] = [];
  for (const member of members) {
    const score = member.messages + member.reactions * REACTION_WEIGHT;
    if (score >= minScore) {
      ranked.push({ userId: member.userId, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.userId - b.userId);
  return ranked.slice(0, limit);
};

/**
 * A single submission to a creativity mini-challenge (meme, idea, design,
 * phrase or story) together with the number of votes it has received.
 * Pure data shape.
 */
export interface CreativityChallengeEntry {
  /** Stable identifier of the submission. */
  readonly id: string;
  /** Accumulated vote count; may be zero or negative (net of down-votes). */
  readonly votes: number;
}

/**
 * Outcome of resolving a creativity mini-challenge: the full ordered ranking
 * plus the winning submission id (undefined when there are no entries).
 * Pure data shape.
 */
export interface CreativityChallengeResult {
  /** Id of the top-ranked submission, or undefined when there are no entries. */
  readonly winnerId: string | undefined;
  /** Entries ordered by votes descending, ties broken by id ascending. */
  readonly ranking: readonly CreativityChallengeEntry[];
}

/**
 * Resolves a creativity mini-challenge by ranking the submissions and picking
 * a winner. Ranking is sorted by votes descending; ties are broken by id in
 * ascending lexicographic order so the result is fully deterministic. The
 * winner is the first entry of the ranking, or undefined when the input is
 * empty. The input array is not mutated. Pure and deterministic.
 */
export const resolveCreativityChallenge = (
  entries: readonly CreativityChallengeEntry[],
): CreativityChallengeResult => {
  const ranking = [...entries].sort((a, b) => {
    if (a.votes !== b.votes) {
      return b.votes - a.votes;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  const top = ranking[0];
  return {
    winnerId: top !== undefined ? top.id : undefined,
    ranking,
  };
};

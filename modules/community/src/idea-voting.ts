/**
 * A single idea that group owners can vote on to decide which module comes next.
 * Pure and deterministic.
 */
export interface VotedIdea {
  readonly id: string;
  readonly title: string;
  readonly votes: number;
}

/**
 * A ranked idea: the original idea plus its 1-based position after sorting.
 * Pure and deterministic.
 */
export interface RankedIdea {
  readonly id: string;
  readonly title: string;
  readonly votes: number;
  readonly rank: number;
}

/**
 * Ranks votable ideas so owners can see which module wins next.
 * Sorts by votes descending, breaking ties by title ascending (case-insensitive,
 * then case-sensitive as a stable final tiebreak), and assigns a 1-based rank
 * following the resulting output order. Returns an empty array for empty input.
 * Does not mutate the input.
 * Pure and deterministic.
 */
export const rankVotedIdeas = (
  ideas: readonly VotedIdea[],
): readonly RankedIdea[] => {
  const sorted = [...ideas].sort((a, b) => {
    if (a.votes !== b.votes) {
      return b.votes - a.votes;
    }
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    if (aTitle < bTitle) {
      return -1;
    }
    if (aTitle > bTitle) {
      return 1;
    }
    if (a.title < b.title) {
      return -1;
    }
    if (a.title > b.title) {
      return 1;
    }
    return 0;
  });
  return sorted.map((idea, index) => ({
    id: idea.id,
    title: idea.title,
    votes: idea.votes,
    rank: index + 1,
  }));
};

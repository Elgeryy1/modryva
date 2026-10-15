/** A ranking entry: a user and their score. Pure and deterministic. */
export interface TitleRankingEntry {
  readonly userId: number;
  readonly score: number;
}

/** A temporary title assigned to a user. Pure and deterministic. */
export interface AssignedTitle {
  readonly userId: number;
  readonly title: string;
}

/**
 * Assigns temporary titles (e.g. "Helper de la semana") to the top-ranked users.
 * Users are ranked by score descending, then userId ascending; the first title
 * goes to the top user, and so on until either list runs out. Does not mutate
 * inputs. Pure and deterministic.
 */
export const assignTemporaryTitles = (
  rankings: readonly TitleRankingEntry[],
  titles: readonly string[],
): readonly AssignedTitle[] => {
  const sorted = [...rankings].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.userId - b.userId;
  });
  const assigned: AssignedTitle[] = [];
  const count = Math.min(sorted.length, titles.length);
  for (let index = 0; index < count; index += 1) {
    const entry = sorted[index];
    const title = titles[index];
    if (entry !== undefined && title !== undefined) {
      assigned.push({ userId: entry.userId, title });
    }
  }
  return assigned;
};

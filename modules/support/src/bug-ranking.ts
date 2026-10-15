/**
 * A single raw bug report submitted by a user.
 * Pure data shape used as input to the ranking.
 */
export interface BugReport {
  /** Stable identifier that groups reports about the same bug. */
  readonly bugId: string;
  /** Human-readable bug title (as sent in this report). */
  readonly title: string;
}

/**
 * A ranked row in the "most reported bugs" dashboard.
 * The title is taken from the first report seen for its bugId.
 */
export interface RankedBug {
  /** Stable identifier of the bug. */
  readonly bugId: string;
  /** Title taken from the first occurrence of this bugId. */
  readonly title: string;
  /** How many reports referenced this bugId. */
  readonly count: number;
}

/**
 * Ranks reported bugs for a "most reported" dashboard. Tallies how many
 * reports share each bugId, keeps the title from the first report seen for
 * that bugId, and returns rows sorted by count descending, breaking ties by
 * bugId ascending. Empty input yields an empty list.
 * Pure and deterministic.
 */
export const rankReportedBugs = (
  reports: readonly BugReport[],
): readonly RankedBug[] => {
  const counts = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const report of reports) {
    const previous = counts.get(report.bugId) ?? 0;
    counts.set(report.bugId, previous + 1);
    if (!titles.has(report.bugId)) {
      titles.set(report.bugId, report.title);
    }
  }
  const rows: RankedBug[] = [];
  for (const [bugId, count] of counts) {
    const title = titles.get(bugId) ?? "";
    rows.push({ bugId, title, count });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.bugId < b.bugId ? -1 : a.bugId > b.bugId ? 1 : 0;
  });
  return rows;
};

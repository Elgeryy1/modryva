/**
 * A single moderation report awaiting resolution.
 * Pure and deterministic.
 */
export interface Report {
  readonly id: string;
  readonly reason: string;
}

/**
 * A cluster of reports that share the same normalized reason, ready to be
 * closed in a single batch action.
 * Pure and deterministic.
 */
export interface ReportGroup {
  readonly reason: string;
  readonly ids: readonly string[];
  readonly count: number;
}

/**
 * Normalizes a reason for clustering: lowercased, trimmed, accents stripped
 * (via NFD decomposition) and inner whitespace collapsed to single spaces.
 * Returns plain ASCII-friendly text. Pure and deterministic.
 */
export const normalizeReason = (reason: string): string =>
  reason
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/**
 * Groups similar reports so a moderator can close them in one action.
 * Reports are clustered by their normalized reason (see normalizeReason).
 * Groups are sorted by count descending, ties broken by reason ascending.
 * Within each group, ids preserve input order. Empty input yields an empty
 * list. Pure and deterministic.
 */
export const groupSimilarReports = (
  reports: readonly Report[],
): readonly ReportGroup[] => {
  const buckets = new Map<string, string[]>();
  for (const report of reports) {
    const key = normalizeReason(report.reason);
    const existing = buckets.get(key);
    if (existing === undefined) {
      buckets.set(key, [report.id]);
    } else {
      existing.push(report.id);
    }
  }

  const groups: ReportGroup[] = [];
  for (const [reason, ids] of buckets) {
    groups.push({ reason, ids, count: ids.length });
  }

  return [...groups].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    if (a.reason < b.reason) {
      return -1;
    }
    if (a.reason > b.reason) {
      return 1;
    }
    return 0;
  });
};

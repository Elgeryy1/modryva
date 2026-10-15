/**
 * A single collectible entry in a season album: an achievement, event
 * or memorable moment recorded at a given moment in time.
 * Pure and deterministic.
 */
export interface SeasonAlbumEntry {
  /** Category of the entry (for example "logro", "evento", "momento"). */
  readonly kind: string;
  /** Human-readable title of the entry. */
  readonly title: string;
  /** Epoch milliseconds when the entry happened. */
  readonly atMs: number;
}

/**
 * Aggregated count for one kind of entry inside a season album.
 * Pure and deterministic.
 */
export interface SeasonAlbumKindTally {
  /** Category being tallied. */
  readonly kind: string;
  /** Number of entries of this kind. */
  readonly count: number;
}

/**
 * Summary of a whole season album: the total number of entries and the
 * per-kind tally, plus the time span covered by the entries.
 * Pure and deterministic.
 */
export interface SeasonAlbum {
  /** Total number of entries in the album. */
  readonly total: number;
  /** Per-kind tallies, sorted by count desc then kind asc. */
  readonly byKind: readonly SeasonAlbumKindTally[];
  /** Earliest atMs across entries, or undefined when the album is empty. */
  readonly firstAtMs: number | undefined;
  /** Latest atMs across entries, or undefined when the album is empty. */
  readonly lastAtMs: number | undefined;
}

/**
 * Compares two kind tallies for stable ordering: higher count first,
 * ties broken by kind ascending using plain code-point comparison.
 * Kept internal to avoid barrel symbol clashes.
 */
const compareKindTally = (
  a: SeasonAlbumKindTally,
  b: SeasonAlbumKindTally,
): number => {
  if (a.count !== b.count) {
    return b.count - a.count;
  }
  if (a.kind < b.kind) {
    return -1;
  }
  if (a.kind > b.kind) {
    return 1;
  }
  return 0;
};

/**
 * Builds a season album summary from a list of entries. Entries whose kind
 * is empty or only whitespace are ignored. Counts are tallied by kind and
 * returned sorted by count descending then kind ascending. The time span
 * (firstAtMs/lastAtMs) covers only the counted entries. Empty or all-ignored
 * input yields total 0, an empty byKind list, and undefined span bounds.
 * Pure and deterministic.
 */
export const buildSeasonAlbum = (
  entries: readonly SeasonAlbumEntry[],
): SeasonAlbum => {
  const counts = new Map<string, number>();
  let total = 0;
  let firstAtMs: number | undefined;
  let lastAtMs: number | undefined;

  for (const entry of entries) {
    const kind = entry.kind.trim();
    if (kind.length === 0) {
      continue;
    }
    total += 1;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (firstAtMs === undefined || entry.atMs < firstAtMs) {
      firstAtMs = entry.atMs;
    }
    if (lastAtMs === undefined || entry.atMs > lastAtMs) {
      lastAtMs = entry.atMs;
    }
  }

  const byKind: SeasonAlbumKindTally[] = [];
  for (const [kind, count] of counts) {
    byKind.push({ kind, count });
  }
  byKind.sort(compareKindTally);

  return {
    total,
    byKind,
    firstAtMs,
    lastAtMs,
  };
};

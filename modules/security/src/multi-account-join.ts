/**
 * Multi-account join detector.
 *
 * Flags coordinated raids where several accounts with near-identical names
 * join a group almost at the same time (a common sockpuppet / spam pattern).
 * All logic is pure: no clock access, time is provided via each join event.
 */

/**
 * A single join event: the account display name and the moment it joined,
 * expressed as epoch milliseconds. Pure data, no behavior.
 */
export interface MultiAccountJoinEvent {
  readonly name: string;
  readonly joinMs: number;
}

/**
 * Tuning knobs for the detector. All fields are optional and fall back to
 * sensible defaults (60s window, cluster of 3, 4-char shared prefix).
 * Pure and deterministic.
 */
export interface MultiAccountJoinSettings {
  /** Max time span (ms) a group of joins may occupy to count as one burst. */
  readonly windowMs?: number;
  /** Minimum cluster size that trips the suspicious flag. */
  readonly minCluster?: number;
  /** Minimum shared normalized-name prefix length to group two accounts. */
  readonly prefixMinLen?: number;
}

/**
 * Outcome of the multi-account analysis: whether a raid was detected, the
 * size of the largest near-simultaneous similar-name cluster, and the shared
 * name prefix of that cluster (empty when nothing qualified).
 * Pure and deterministic.
 */
export interface MultiAccountJoinVerdict {
  readonly suspicious: boolean;
  readonly clusterSize: number;
  readonly clusterPrefix: string;
}

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MIN_CLUSTER = 3;
const DEFAULT_PREFIX_MIN_LEN = 4;

/**
 * Normalizes a display name for comparison: strips diacritics, lowercases,
 * and keeps only ASCII letters and digits. Internal helper.
 */
const normalizeName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Largest count of ascending-sorted timestamps that fit inside any window of
 * length windowMs, via a sliding window. Internal helper.
 */
const maxWithinWindow = (
  sortedTimes: readonly number[],
  windowMs: number,
): number => {
  let best = 0;
  let start = 0;
  for (let end = 0; end < sortedTimes.length; end++) {
    const endTime = sortedTimes[end] ?? 0;
    let startTime = sortedTimes[start] ?? 0;
    while (start < end && endTime - startTime > windowMs) {
      start++;
      startTime = sortedTimes[start] ?? 0;
    }
    const count = end - start + 1;
    if (count > best) {
      best = count;
    }
  }
  return best;
};

/**
 * Detects a multi-account raid: several accounts whose normalized names share
 * a long common prefix and that join within windowMs of one another. Groups
 * joins by their leading normalized prefix, finds the tightest time burst in
 * each group, and reports the largest one. Ties are broken by ascending
 * prefix order so the result never depends on input ordering.
 * Pure and deterministic.
 */
export const detectMultiAccountJoin = (
  joins: readonly MultiAccountJoinEvent[],
  options?: MultiAccountJoinSettings,
): MultiAccountJoinVerdict => {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const minCluster = options?.minCluster ?? DEFAULT_MIN_CLUSTER;
  const prefixMinLen = options?.prefixMinLen ?? DEFAULT_PREFIX_MIN_LEN;

  const groups = new Map<string, number[]>();
  for (const join of joins) {
    const normalized = normalizeName(join.name);
    if (normalized.length < prefixMinLen) {
      continue;
    }
    const key = normalized.slice(0, prefixMinLen);
    const bucket = groups.get(key) ?? [];
    bucket.push(join.joinMs);
    groups.set(key, bucket);
  }

  let bestSize = 0;
  let bestPrefix = "";
  const sortedKeys = Array.from(groups.keys()).sort();
  for (const key of sortedKeys) {
    const times = groups.get(key) ?? [];
    const sorted = [...times].sort((a, b) => a - b);
    const size = maxWithinWindow(sorted, windowMs);
    if (size > bestSize) {
      bestSize = size;
      bestPrefix = key;
    }
  }

  return {
    suspicious: bestSize >= minCluster,
    clusterSize: bestSize,
    clusterPrefix: bestPrefix,
  };
};

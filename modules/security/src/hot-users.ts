/**
 * Real-time tension reading for a single user, coming from a live discussion.
 * `tension` is a non-negative heat score; higher means a hotter exchange.
 * Pure and deterministic.
 */
export interface HotUserActivity {
  readonly userId: number;
  readonly tension: number;
}

/**
 * Tuning for {@link listHotUsers}. `minTension` is the inclusive floor a user
 * must reach to count as "hot" (default 5). `topN` caps how many users the
 * report returns (default 10). Pure and deterministic.
 */
export interface ListHotUsersOptions {
  readonly minTension?: number;
  readonly topN?: number;
}

/**
 * A user currently flagged as hot, carrying their peak tension. Pure and deterministic.
 */
export interface HotUser {
  readonly userId: number;
  readonly tension: number;
}

const DEFAULT_MIN_TENSION = 5;
const DEFAULT_TOP_N = 10;

/**
 * Builds the "usuarios calientes ahora" list from recent tension readings.
 *
 * It keeps the maximum tension seen per userId, drops anyone below
 * `minTension`, sorts by tension descending (ties broken by userId ascending),
 * and returns at most `topN` entries. Non-finite or negative `topN` yields an
 * empty list; a fractional `topN` is floored. Pure and deterministic.
 */
export const listHotUsers = (
  recent: readonly HotUserActivity[],
  options?: ListHotUsersOptions,
): readonly HotUser[] => {
  const minTension = options?.minTension ?? DEFAULT_MIN_TENSION;
  const rawTopN = options?.topN ?? DEFAULT_TOP_N;
  const topN = Number.isFinite(rawTopN) ? Math.floor(rawTopN) : 0;
  if (topN <= 0) {
    return [];
  }

  const peakByUser = new Map<number, number>();
  for (const activity of recent) {
    const previous = peakByUser.get(activity.userId);
    if (previous === undefined || activity.tension > previous) {
      peakByUser.set(activity.userId, activity.tension);
    }
  }

  const hot: HotUser[] = [];
  for (const [userId, tension] of peakByUser) {
    if (tension >= minTension) {
      hot.push({ userId, tension });
    }
  }

  hot.sort((a, b) => b.tension - a.tension || a.userId - b.userId);

  return hot.slice(0, topN);
};

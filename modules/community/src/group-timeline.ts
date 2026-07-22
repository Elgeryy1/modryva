/**
 * A single milestone in a group's collective memory timeline.
 * `atMs` is the Unix timestamp (milliseconds) the event happened,
 * `title` is the short human-readable label shown to members.
 * Pure and deterministic.
 */
export interface GroupTimelineEvent {
  readonly atMs: number;
  readonly title: string;
}

/**
 * Compares two events for timeline ordering: primary key is `atMs`
 * ascending, tie-broken by `title` ascending (Unicode code point order).
 * Returns a negative, zero, or positive number like Array.prototype.sort.
 * Pure and deterministic.
 */
const compareTimelineEvents = (
  a: GroupTimelineEvent,
  b: GroupTimelineEvent,
): number => {
  if (a.atMs !== b.atMs) {
    return a.atMs < b.atMs ? -1 : 1;
  }
  if (a.title === b.title) {
    return 0;
  }
  return a.title < b.title ? -1 : 1;
};

/**
 * Builds the group's collective-memory timeline from a list of important
 * events. Sorts by `atMs` ascending, breaking ties by `title` ascending.
 * The sort is stable, so events sharing the same `atMs` and `title` keep
 * their original relative order. Always returns a NEW array and never
 * mutates the input. An empty input yields an empty timeline.
 * Pure and deterministic.
 */
export const buildGroupTimeline = (
  events: readonly GroupTimelineEvent[],
): readonly GroupTimelineEvent[] => {
  return [...events].sort(compareTimelineEvents);
};

/**
 * A single profile badge with a privacy flag controlling public visibility.
 * `hidden` true means the owner has opted to keep this badge private.
 */
export interface ProfileBadge {
  readonly id: string;
  readonly hidden: boolean;
}

/**
 * Returns the ids of badges the owner has chosen to display publicly,
 * i.e. every badge whose `hidden` flag is false, preserving input order.
 * Duplicate ids are preserved (dedup is a display concern, not privacy).
 * Empty input yields an empty list. Pure and deterministic.
 */
export const filterVisibleBadges = (
  badges: readonly ProfileBadge[],
): readonly string[] => {
  const visible: string[] = [];
  for (const badge of badges) {
    if (!badge.hidden) {
      visible.push(badge.id);
    }
  }
  return visible;
};

/**
 * Summary of a profile's badge privacy state: how many badges exist in
 * total and how many are publicly visible after applying the privacy flags.
 * Pure and deterministic.
 */
export interface BadgePrivacySummary {
  readonly total: number;
  readonly visible: number;
  readonly hiddenCount: number;
  readonly allHidden: boolean;
}

/**
 * Computes counts describing the current profile privacy state. `allHidden`
 * is false for an empty profile (there is nothing being hidden).
 * Pure and deterministic.
 */
export const summarizeBadgePrivacy = (
  badges: readonly ProfileBadge[],
): BadgePrivacySummary => {
  const total = badges.length;
  const visible = filterVisibleBadges(badges).length;
  const hiddenCount = total - visible;
  return {
    total,
    visible,
    hiddenCount,
    allHidden: total > 0 && visible === 0,
  };
};

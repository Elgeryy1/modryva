/**
 * Staff confidence panel driven by confirmed actions, not popularity. Pure
 * logic: it takes counts of moderation actions that were confirmed (upheld on
 * review) or reverted (undone later) and returns a 0..100 score, a qualitative
 * band, and the total number of actions considered. It also ranks several staff
 * members into a deterministic panel. No I/O, no network, no Date.now().
 */

/** Qualitative confidence band, from lowest to highest. Pure and deterministic. */
export type StaffConfidenceBand = "baja" | "media" | "alta";

/**
 * Raw action counts for a staff member. `confirmed` actions were upheld on
 * review; `reverted` actions were undone afterwards. Pure and deterministic.
 */
export interface StaffActionTally {
  readonly confirmed: number;
  readonly reverted: number;
}

/**
 * Computed confidence panel: a 0..100 score, its band, and the total number of
 * actions considered (confirmed + reverted). Pure and deterministic.
 */
export interface StaffConfidence {
  readonly score: number;
  readonly band: StaffConfidenceBand;
  readonly total: number;
}

/** Counts for an identified staff member, used to rank the panel. Pure and deterministic. */
export interface StaffMemberTally extends StaffActionTally {
  readonly id: string;
}

/** Ranking entry: the computed confidence plus the member id. Pure and deterministic. */
export interface StaffConfidenceEntry extends StaffConfidence {
  readonly id: string;
}

/** Minimum score (inclusive) that lands in the "media" band. Pure and deterministic. */
export const MEDIA_THRESHOLD = 50;

/** Minimum score (inclusive) that lands in the "alta" band. Pure and deterministic. */
export const ALTA_THRESHOLD = 80;

/** Normalizes a count: negative, NaN or infinite values count as 0; truncated to an integer. */
const sanitizeCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Maps a 0..100 score to its band using the thresholds. */
const bandForScore = (score: number): StaffConfidenceBand => {
  if (score >= ALTA_THRESHOLD) {
    return "alta";
  }
  if (score >= MEDIA_THRESHOLD) {
    return "media";
  }
  return "baja";
};

/**
 * Computes the confidence panel for a staff member. The score is the percentage
 * of confirmed actions over the total (confirmed + reverted), rounded to an
 * integer in 0..100. Negative, NaN or infinite counts are treated as 0. With no
 * actions (total 0) it returns score 0 and band "baja". The band comes from
 * comparing the score with MEDIA_THRESHOLD and ALTA_THRESHOLD. Pure and
 * deterministic.
 */
export const computeStaffConfidence = (
  input: StaffActionTally,
): StaffConfidence => {
  const confirmed = sanitizeCount(input.confirmed);
  const reverted = sanitizeCount(input.reverted);
  const total = confirmed + reverted;
  if (total === 0) {
    return { score: 0, band: "baja", total: 0 };
  }
  const score = Math.round((confirmed / total) * 100);
  return { score, band: bandForScore(score), total };
};

/**
 * Ranks several staff members by confidence to build the panel. Sorts by score
 * descending; ties break by total actions descending (more evidence weighs
 * more); further ties break by id ascending for a stable order. Does not mutate
 * the received array. Pure and deterministic.
 */
export const rankStaffConfidence = (
  members: readonly StaffMemberTally[],
): readonly StaffConfidenceEntry[] => {
  const entries: StaffConfidenceEntry[] = members.map((member) => {
    const confidence = computeStaffConfidence(member);
    return {
      id: member.id,
      score: confidence.score,
      band: confidence.band,
      total: confidence.total,
    };
  });
  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
};

/** A candidate to be mentor of the day and how many members they helped. */
export interface MentorCandidate {
  readonly userId: number;
  readonly helps: number;
}

/**
 * The chosen mentor of the day. mentorId is undefined when nobody helped.
 * Pure and deterministic.
 */
export interface MentorOfDay {
  readonly mentorId: number | undefined;
  readonly helps: number;
}

/**
 * Picks the mentor of the day: the candidate with the most helps (must be at
 * least 1), breaking ties by lowest userId. With no qualifying candidate the
 * mentorId is undefined and helps is 0. Pure and deterministic.
 */
export const pickMentorOfDay = (
  candidates: readonly MentorCandidate[],
): MentorOfDay => {
  let best: MentorCandidate | undefined;
  for (const candidate of candidates) {
    if (candidate.helps <= 0) {
      continue;
    }
    if (
      best === undefined ||
      candidate.helps > best.helps ||
      (candidate.helps === best.helps && candidate.userId < best.userId)
    ) {
      best = candidate;
    }
  }
  return { mentorId: best?.userId, helps: best?.helps ?? 0 };
};

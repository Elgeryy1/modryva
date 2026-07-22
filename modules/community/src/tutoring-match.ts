/**
 * Peer tutoring matcher: pair a learner who needs help with the tutor best
 * suited to give it. Pure and deterministic — no I/O, no clock, no randomness.
 * The whole decision derives from the plain inputs handed in by the caller.
 */

/** Someone asking for help on one or more topics at a given skill level. */
export interface Learner {
  readonly userId: string;
  readonly topics: readonly string[];
  readonly level: number;
}

/**
 * Someone able to teach one or more topics. `level` is their skill and `load`
 * is how many learners they already carry (lower is preferred as a tie-break).
 */
export interface Tutor {
  readonly userId: string;
  readonly topics: readonly string[];
  readonly level: number;
  readonly load: number;
}

/** The chosen tutor together with the topic-overlap score that won them. */
export interface TutorMatch {
  readonly tutorId: string;
  readonly score: number;
}

/**
 * Counts how many distinct learner topics the tutor also covers. Duplicates in
 * either list collapse (a topic shared once counts once). Pure.
 */
export const tutoringOverlapScore = (
  learner: Learner,
  tutor: Tutor,
): number => {
  const tutorTopics = new Set(tutor.topics);
  let score = 0;
  const counted = new Set<string>();
  for (const topic of learner.topics) {
    if (!counted.has(topic) && tutorTopics.has(topic)) {
      counted.add(topic);
      score += 1;
    }
  }
  return score;
};

/**
 * True when a tutor is eligible for a learner: their skill level is at least
 * the learner's and they share at least one topic. Pure.
 */
export const tutoringIsEligible = (learner: Learner, tutor: Tutor): boolean =>
  tutor.level >= learner.level && tutoringOverlapScore(learner, tutor) > 0;

/**
 * Picks the best tutor for a learner, or null when none qualifies. A tutor
 * qualifies only if their level is >= the learner's and they share at least one
 * topic. Among the eligible, the winner has (in order): the greatest topic
 * overlap, then the lowest load, then the lowest level, then the smallest
 * userId (lexicographic) as a final deterministic tie-break. Pure.
 */
export const matchTutor = (
  learner: Learner,
  tutors: readonly Tutor[],
): TutorMatch | null => {
  let best: Tutor | null = null;
  let bestScore = 0;

  for (const tutor of tutors) {
    const score = tutoringOverlapScore(learner, tutor);
    if (tutor.level < learner.level || score <= 0) {
      continue;
    }

    if (best === null || tutoringBeats(tutor, score, best, bestScore)) {
      best = tutor;
      bestScore = score;
    }
  }

  if (best === null) {
    return null;
  }

  return { tutorId: best.userId, score: bestScore };
};

/**
 * Total order over candidate tutors: greater score wins, then lower load, then
 * lower level, then smaller userId. Returns true when `a` should replace `b`.
 */
const tutoringBeats = (
  a: Tutor,
  aScore: number,
  b: Tutor,
  bScore: number,
): boolean => {
  if (aScore !== bScore) {
    return aScore > bScore;
  }
  if (a.load !== b.load) {
    return a.load < b.load;
  }
  if (a.level !== b.level) {
    return a.level < b.level;
  }
  return a.userId < b.userId;
};

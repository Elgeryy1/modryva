/**
 * Maximum number of days since the last rules review before the "review rules"
 * task is considered pending again. Pure and deterministic.
 */
const RULES_REVIEW_MAX_DAYS = 7;

/**
 * Snapshot of the group state used to derive the owner's weekly checklist.
 * All counts are expected to be non-negative; negative values are treated as
 * zero so a task never appears falsely pending. Pure and deterministic.
 */
export interface OwnerWeeklyState {
  /** Number of moderation appeals still awaiting the owner's decision. */
  readonly pendingAppeals: number;
  /** Number of security or moderation incidents still open. */
  readonly openIncidents: number;
  /** Whole days elapsed since the group rules were last reviewed. */
  readonly rulesReviewedDaysAgo: number;
}

/**
 * A single checklist entry: a user-facing Spanish task label and whether the
 * current state already satisfies it. Pure and deterministic.
 */
export interface OwnerChecklistTask {
  /** User-facing Spanish description of the task. */
  readonly task: string;
  /** True when the current state already satisfies this task. */
  readonly done: boolean;
}

/**
 * Coerces a possibly-negative or non-finite count to a safe non-negative
 * integer floor. Internal helper. Pure and deterministic.
 */
const safeCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Builds the owner's fixed weekly checklist in a stable order: appeals first,
 * then open incidents, then the periodic rules review. Each task's done flag is
 * derived purely from the given state (no pending appeals -> done, no open
 * incidents -> done, rules reviewed within RULES_REVIEW_MAX_DAYS -> done).
 * Pure and deterministic.
 */
export const buildOwnerChecklist = (
  state: OwnerWeeklyState,
): readonly OwnerChecklistTask[] => {
  const pendingAppeals = safeCount(state.pendingAppeals);
  const openIncidents = safeCount(state.openIncidents);
  const rulesDaysAgo = safeCount(state.rulesReviewedDaysAgo);
  return [
    {
      task: "📨 Resolver las apelaciones pendientes",
      done: pendingAppeals === 0,
    },
    {
      task: "🚨 Cerrar los incidentes abiertos",
      done: openIncidents === 0,
    },
    {
      task: "📜 Revisar las reglas del grupo",
      done: rulesDaysAgo <= RULES_REVIEW_MAX_DAYS,
    },
  ];
};

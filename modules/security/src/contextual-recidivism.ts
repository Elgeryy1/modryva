/**
 * A past moderation event in a user's history. `context` names where it
 * happened (for example a chat title or topic name) and `kind` names the
 * offense category (for example "spam" or "flood"). Pure and deterministic.
 */
export interface ContextualEvent {
  readonly context: string;
  readonly kind: string;
}

/**
 * The current offense being evaluated. Only its `kind` is compared against
 * the history. Pure and deterministic.
 */
export interface ContextualCurrentOffense {
  readonly kind: string;
}

/**
 * Outcome of a contextual-recidivism check. `recidivist` is true when the
 * same kind of offense already happened in at least one prior context.
 * `priorContexts` lists those distinct contexts, in first-appearance order.
 * Pure and deterministic.
 */
export interface ContextualRecidivismResult {
  readonly recidivist: boolean;
  readonly priorContexts: readonly string[];
}

/**
 * Detects contextual recidivism: not merely "this user has warnings" but
 * "this user already did THIS SAME kind of thing in another context".
 *
 * Scans `history` for events whose `kind` equals `current.kind`, collecting
 * the distinct `context` values in first-appearance order. Empty history or
 * no matching kind yields a non-recidivist result with an empty list.
 * Pure and deterministic.
 */
export const detectContextualRecidivism = (
  history: readonly ContextualEvent[],
  current: ContextualCurrentOffense,
): ContextualRecidivismResult => {
  const priorContexts: string[] = [];
  for (const event of history) {
    if (event.kind === current.kind && !priorContexts.includes(event.context)) {
      priorContexts.push(event.context);
    }
  }
  return { recidivist: priorContexts.length > 0, priorContexts };
};

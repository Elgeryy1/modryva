/**
 * A pending action awaiting execution during saturation. Pure and
 * deterministic.
 */
export interface PendingAction {
  readonly id: string;
  readonly kind: string;
}

/** An action tagged with its computed priority. Pure and deterministic. */
export interface PrioritizedAction {
  readonly id: string;
  readonly priority: number;
}

/** Priority weight per action kind; unknown kinds fall back to 0. */
const KIND_PRIORITY: Record<string, number> = {
  ban: 3,
  raid: 3,
  mute: 2,
  warn: 1,
};

/**
 * Orders pending actions so the most critical run first during saturation.
 * Each action gets a priority by kind (ban/raid=3, mute=2, warn=1, else 0),
 * then results are sorted by priority descending and id ascending. Does not
 * mutate the input. Pure and deterministic.
 */
export const prioritizeActions = (
  actions: readonly PendingAction[],
): readonly PrioritizedAction[] =>
  actions
    .map((action) => ({
      id: action.id,
      priority: KIND_PRIORITY[action.kind.trim().toLowerCase()] ?? 0,
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

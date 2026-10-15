/**
 * Gmail-style "deshacer": a bounded stack of undoable actions, each valid only
 * within a time window. Pure and deterministic; callers pass `nowMs` and plain
 * data so no clock or storage is touched here. The service layer decides when
 * an action is actually reverted; this module only answers "is it still
 * undoable" and keeps the recent stack bounded.
 */

/**
 * An action a user may still undo. `ms` is the epoch timestamp (milliseconds)
 * at which the action happened; `id` identifies the action to the caller.
 */
export interface UndoableAction {
  readonly id: string;
  readonly ms: number;
}

/** Default undo window in milliseconds (30 seconds), Gmail-like. */
export const UNDO_DEFAULT_WINDOW_MS = 30_000;

/**
 * True when `action` is still within its undo window: the elapsed time
 * `nowMs - action.ms` is between 0 and `windowMs` inclusive. Actions dated in
 * the future (negative elapsed) are not undoable, and a non-positive
 * `windowMs` makes every past action non-undoable. Pure and deterministic.
 */
export const canUndo = (
  action: UndoableAction,
  nowMs: number,
  windowMs: number,
): boolean => {
  const elapsed = nowMs - action.ms;
  return elapsed >= 0 && elapsed <= windowMs;
};

/**
 * Pushes `action` onto the stack, most-recent-first, keeping at most `maxSize`
 * entries by dropping the oldest from the tail. Returns a new array and never
 * mutates the input. A `maxSize` of 0 or less yields an empty stack. Pure and
 * deterministic.
 */
export const pushUndo = (
  stack: readonly UndoableAction[],
  action: UndoableAction,
  maxSize: number,
): readonly UndoableAction[] => {
  if (maxSize <= 0) {
    return [];
  }
  return [action, ...stack].slice(0, maxSize);
};

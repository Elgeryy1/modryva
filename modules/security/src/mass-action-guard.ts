/**
 * Mass-action guard: brake against destructive bulk operations (mass kicks,
 * bans or message deletions) fired in a short window. When too many targets
 * are hit inside the window the caller should stop and ask for explicit
 * confirmation instead of executing blindly. Pure and deterministic: every
 * input is a plain value and the caller supplies `nowMs`, so there is no I/O,
 * clock or randomness here.
 */

/**
 * A single destructive action that already happened. `kind` is a free-form
 * label ("ban", "kick", "delete", ...), `targetCount` is how many entities it
 * affected (>= 0) and `ms` is the epoch timestamp (ms) at which it occurred.
 */
export interface DestructiveAction {
  readonly kind: string;
  readonly targetCount: number;
  readonly ms: number;
}

/** Outcome of the guard check. `reason` is empty when not blocked. */
export interface MassActionVerdict {
  readonly blocked: boolean;
  readonly reason: string;
}

/**
 * Keeps only the actions that fall inside the window `(nowMs - windowMs, nowMs]`.
 * Actions in the future (ms > nowMs) or at/older than the window edge are
 * dropped. A non-positive `windowMs` yields an empty list. Preserves order.
 * Pure and deterministic.
 */
export const massActionWithinWindow = (
  recent: readonly DestructiveAction[],
  windowMs: number,
  nowMs: number,
): DestructiveAction[] => {
  if (windowMs <= 0) {
    return [];
  }
  const lowerBound = nowMs - windowMs;
  return recent.filter(
    (action) => action.ms > lowerBound && action.ms <= nowMs,
  );
};

/**
 * Sums the affected targets across the actions inside the window. Negative
 * `targetCount` values are floored to 0 so a bad input cannot mask a burst.
 * Pure and deterministic.
 */
export const massActionTargetsInWindow = (
  recent: readonly DestructiveAction[],
  windowMs: number,
  nowMs: number,
): number => {
  let total = 0;
  for (const action of massActionWithinWindow(recent, windowMs, nowMs)) {
    total += action.targetCount > 0 ? action.targetCount : 0;
  }
  return total;
};

/**
 * Decides whether a burst of destructive actions must be paused for
 * confirmation. Sums the targets affected within the last `windowMs` and blocks
 * when that total reaches `threshold`. A threshold <= 0 never blocks (guard is
 * effectively disabled). Returns `{ blocked, reason }` with a user-facing
 * Spanish reason when blocked, or an empty reason otherwise. Pure and
 * deterministic.
 */
export const detectMassAction = (
  recent: readonly DestructiveAction[],
  windowMs: number,
  nowMs: number,
  threshold: number,
): MassActionVerdict => {
  if (threshold <= 0) {
    return { blocked: false, reason: "" };
  }

  const total = massActionTargetsInWindow(recent, windowMs, nowMs);

  if (total >= threshold) {
    return {
      blocked: true,
      reason: `⚠️ Se han detectado ${total} acciones destructivas en muy poco tiempo. Confirma que quieres continuar para evitar un borrado masivo accidental.`,
    };
  }

  return { blocked: false, reason: "" };
};

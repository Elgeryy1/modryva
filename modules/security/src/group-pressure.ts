/**
 * A single recent message considered by the group-pressure detector.
 * `mentionsTarget` means the message points at the target user; `isDemand`
 * means it pushes them to act (respond, apologize, leave, etc.).
 */
export interface PressureMessage {
  readonly authorId: number;
  readonly mentionsTarget: boolean;
  readonly isDemand: boolean;
}

/**
 * Input for {@link detectGroupPressure}: the user under scrutiny plus the
 * window of recent messages to inspect.
 */
export interface GroupPressureInput {
  readonly targetUserId: number;
  readonly recentMessages: readonly PressureMessage[];
}

/**
 * Outcome of the detection: whether the target is under coordinated pressure,
 * how many distinct users are pressuring, and their ids sorted ascending.
 */
export interface GroupPressureResult {
  readonly underPressure: boolean;
  readonly pressurerCount: number;
  readonly pressurers: readonly number[];
}

/** Default number of distinct pressurers required to flag group pressure. */
const DEFAULT_MIN_PRESSURERS = 3;

/**
 * Detects group pressure: distinct users (other than the target) each sending
 * a message that both mentions the target AND is a demand. Returns the sorted,
 * deduplicated set of pressurer ids and flags `underPressure` when their count
 * reaches `minPressurers` (default 3). A `minPressurers` below 1 is treated as
 * 1. The target's own messages are always ignored.
 * Pure and deterministic.
 */
export const detectGroupPressure = (
  input: GroupPressureInput,
  options?: { readonly minPressurers?: number },
): GroupPressureResult => {
  const requested = options?.minPressurers ?? DEFAULT_MIN_PRESSURERS;
  const minPressurers = requested < 1 ? 1 : requested;

  const distinct = new Set<number>();
  for (const message of input.recentMessages) {
    if (message.authorId === input.targetUserId) {
      continue;
    }
    if (message.mentionsTarget && message.isDemand) {
      distinct.add(message.authorId);
    }
  }

  const pressurers = [...distinct].sort((a, b) => a - b);
  return {
    underPressure: pressurers.length >= minPressurers,
    pressurerCount: pressurers.length,
    pressurers,
  };
};

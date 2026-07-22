/**
 * Input snapshot describing a group's liveness at a given instant.
 * Times are epoch milliseconds; members is the current participant count.
 * Pure data, deterministic.
 */
export interface AbandonedGroupInput {
  readonly lastActivityMs: number;
  readonly nowMs: number;
  readonly members: number;
}

/**
 * Tuning knobs for the abandoned-group detector. Omit to use defaults
 * (30 idle days, group considered empty at 1 member or fewer).
 * Pure and deterministic.
 */
export interface AbandonedGroupOptions {
  readonly idleDaysThreshold?: number;
  readonly emptyMembersThreshold?: number;
}

/**
 * Verdict for a group: whether it looks abandoned, how many whole days it
 * has been idle, and whether it is effectively empty of real members.
 * Pure and deterministic.
 */
export interface AbandonedGroupVerdict {
  readonly abandoned: boolean;
  readonly idleDays: number;
  readonly empty: boolean;
}

const DAY_MS = 86_400_000;
const DEFAULT_IDLE_DAYS_THRESHOLD = 30;
const DEFAULT_EMPTY_MEMBERS_THRESHOLD = 1;

/**
 * Detects whether a group where the bot lives looks dead: either it has had
 * no activity for at least idleDaysThreshold whole days, or it is empty of
 * real members (members at or below emptyMembersThreshold). idleDays is the
 * floored count of full days since lastActivityMs and never goes below zero
 * even when lastActivityMs is in the future relative to nowMs.
 * Pure and deterministic.
 */
export const detectAbandonedGroup = (
  input: AbandonedGroupInput,
  options: AbandonedGroupOptions = {},
): AbandonedGroupVerdict => {
  const idleDaysThreshold =
    options.idleDaysThreshold ?? DEFAULT_IDLE_DAYS_THRESHOLD;
  const emptyMembersThreshold =
    options.emptyMembersThreshold ?? DEFAULT_EMPTY_MEMBERS_THRESHOLD;
  const elapsed = input.nowMs - input.lastActivityMs;
  const idleDays = elapsed > 0 ? Math.floor(elapsed / DAY_MS) : 0;
  const empty = input.members <= emptyMembersThreshold;
  const abandoned = idleDays >= idleDaysThreshold || empty;
  return { abandoned, idleDays, empty };
};

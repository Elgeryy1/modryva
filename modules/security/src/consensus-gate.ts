/**
 * A single staff vote on a severe moderation action (for example a ban).
 * `approve` true means this staff member endorses executing the action.
 * Pure and deterministic.
 */
export interface ConsensusVote {
  readonly staffId: number;
  readonly approve: boolean;
}

/**
 * Tuning options for the consensus gate.
 * `minApprovals` is the number of DISTINCT approving staff required to pass;
 * it defaults to 2 and is clamped to a minimum of 1 so an empty vote set can
 * never approve an action.
 * Pure and deterministic.
 */
export interface ConsensusGateOptions {
  readonly minApprovals?: number;
}

/**
 * Outcome of evaluating staff votes against the consensus threshold.
 * `approvals` counts distinct approving staff, `distinctVoters` counts distinct
 * staff who voted at all, and `approved` is true when the threshold is met.
 * Pure and deterministic.
 */
export interface ConsensusGateResult {
  readonly approved: boolean;
  readonly approvals: number;
  readonly distinctVoters: number;
}

/**
 * Evaluates whether a severe moderation action has enough staff consensus.
 * The LAST vote per staffId wins (a staff member can change their mind), so a
 * single staff member never counts twice. Requires at least `minApprovals`
 * distinct approving staff (default 2, clamped to a minimum of 1).
 * Pure and deterministic.
 */
export const requireConsensus = (
  votes: readonly ConsensusVote[],
  options?: ConsensusGateOptions,
): ConsensusGateResult => {
  const requested = options?.minApprovals ?? 2;
  const minApprovals = requested < 1 ? 1 : requested;

  const lastVoteByStaff = new Map<number, boolean>();
  for (const vote of votes) {
    lastVoteByStaff.set(vote.staffId, vote.approve);
  }

  let approvals = 0;
  for (const approve of lastVoteByStaff.values()) {
    if (approve) {
      approvals += 1;
    }
  }

  return {
    approved: approvals >= minApprovals,
    approvals,
    distinctVoters: lastVoteByStaff.size,
  };
};

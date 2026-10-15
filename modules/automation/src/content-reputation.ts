/**
 * Approval history for a piece of content (e.g. a link seen many times).
 * Pure and deterministic.
 */
export interface ContentReputationInput {
  readonly approvals: number;
  readonly rejections: number;
}

/** Options for decideContentReputation. */
export interface ContentReputationOptions {
  readonly minApprovals?: number;
}

/**
 * Reputation verdict for content: whether it is trusted enough to auto-allow
 * and its net score. Pure and deterministic.
 */
export interface ContentReputationResult {
  readonly trusted: boolean;
  readonly score: number;
}

const DEFAULT_MIN_APPROVALS = 20;

/**
 * Decides whether content has earned enough reputation to be auto-allowed.
 * The score is approvals minus rejections. Content is trusted only when it has
 * at least minApprovals approvals (default 20) and has never been rejected.
 * Pure and deterministic.
 */
export const decideContentReputation = (
  input: ContentReputationInput,
  options?: ContentReputationOptions,
): ContentReputationResult => {
  const minApprovals = options?.minApprovals ?? DEFAULT_MIN_APPROVALS;
  const score = input.approvals - input.rejections;
  const trusted = input.approvals >= minApprovals && input.rejections === 0;
  return { trusted, score };
};

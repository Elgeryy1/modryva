/**
 * One of the two debating sides, or "empate" for a tie / double disqualification.
 * Pure and deterministic.
 */
export type DebateDuelSide = "a" | "b";

/**
 * Input for a debate duel: the vote tally for each side and optional insult
 * flags. A side that used insults ("sin insultos" rule) is disqualified,
 * losing regardless of its vote count. Votes are sanitized to non-negative
 * whole numbers; non-finite or negative values are treated as zero.
 * Pure and deterministic.
 */
export interface DebateDuelInput {
  readonly votesA: number;
  readonly votesB: number;
  readonly aInsulted?: boolean;
  readonly bInsulted?: boolean;
}

/**
 * Outcome of a debate duel.
 * - winner: "a", "b", or "empate".
 * - margin: absolute gap between the sanitized vote counts of both sides.
 * - disqualified: sides removed for insults, always in ["a", "b"] order.
 * Pure and deterministic.
 */
export interface DebateDuelResult {
  readonly winner: DebateDuelSide | "empate";
  readonly margin: number;
  readonly disqualified: readonly DebateDuelSide[];
}

/**
 * Sanitizes a raw vote count into a non-negative whole number. Non-finite or
 * non-positive inputs collapse to 0. Internal helper. Pure and deterministic.
 */
const sanitizeVotes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Resolves a controlled debate duel between side "a" and side "b".
 *
 * Disqualification takes priority over votes: any side flagged as having used
 * insults is disqualified and cannot win. If both sides are disqualified the
 * result is "empate". Otherwise, when exactly one side is disqualified the
 * other side wins. With no disqualifications the side with more sanitized votes
 * wins, and equal counts yield "empate". The margin is always the absolute
 * difference between the sanitized vote counts.
 *
 * Pure and deterministic.
 */
export const resolveDebateDuel = (input: DebateDuelInput): DebateDuelResult => {
  const votesA = sanitizeVotes(input.votesA);
  const votesB = sanitizeVotes(input.votesB);
  const margin = Math.abs(votesA - votesB);

  const aInsulted = input.aInsulted === true;
  const bInsulted = input.bInsulted === true;

  const disqualified: DebateDuelSide[] = [];
  if (aInsulted) {
    disqualified.push("a");
  }
  if (bInsulted) {
    disqualified.push("b");
  }

  let winner: DebateDuelSide | "empate";
  if (aInsulted && bInsulted) {
    winner = "empate";
  } else if (aInsulted) {
    winner = "b";
  } else if (bInsulted) {
    winner = "a";
  } else if (votesA > votesB) {
    winner = "a";
  } else if (votesB > votesA) {
    winner = "b";
  } else {
    winner = "empate";
  }

  return { winner, margin, disqualified };
};

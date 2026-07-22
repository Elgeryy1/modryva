/**
 * Input for the self-dealing conflict check. `adminId` is the numeric id of the
 * administrator about to resolve a case; `involvedUserIds` are the ids of every
 * party implicated in that case (reporters, reported, involved parties).
 * Pure and deterministic.
 */
export interface SelfDealingInput {
  readonly adminId: number;
  readonly involvedUserIds: readonly number[];
}

/**
 * Outcome of the self-dealing check. `conflict` is true when the resolving
 * admin is one of the involved parties. `reason` is a user-facing Spanish
 * explanation suitable for showing to admins.
 * Pure and deterministic.
 */
export interface SelfDealingCheck {
  readonly conflict: boolean;
  readonly reason: string;
}

const CONFLICT_REASON =
  "🚫 No puedes resolver este caso porque estás implicado. Debe encargarse otro administrador.";

const CLEAR_REASON =
  "✅ No hay conflicto de interés: puedes resolver este caso.";

/**
 * Blocks self-dealing: an admin may not resolve a case in which they are
 * implicated. Returns a conflict when `adminId` appears anywhere in
 * `involvedUserIds` (duplicates are tolerated). An empty involved list is
 * always conflict-free. The result never depends on ordering.
 * Pure and deterministic.
 */
export const detectSelfDealing = (
  input: SelfDealingInput,
): SelfDealingCheck => {
  const conflict = input.involvedUserIds.includes(input.adminId);
  return {
    conflict,
    reason: conflict ? CONFLICT_REASON : CLEAR_REASON,
  };
};

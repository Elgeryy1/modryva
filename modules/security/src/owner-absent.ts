/**
 * Moderation rules applied when the group owner is absent (owner-absent mode).
 * All values are user-facing safe and computed purely from the inputs.
 */
export interface OwnerAbsentRules {
  /** True when stricter moderation should be enforced. */
  readonly strict: boolean;
  /** True when sensitive actions need multi-admin consensus. */
  readonly requireConsensus: boolean;
  /** Minimum number of admin approvals a sensitive action needs. */
  readonly consensusThreshold: number;
  /** User-facing Spanish note explaining the active mode. */
  readonly note: string;
}

const OWNER_ABSENT_NOTE =
  "🚫 El owner no esta disponible: modo estricto activado. Se requiere consenso de al menos 2 administradores para acciones sensibles.";

const OWNER_PRESENT_NOTE =
  "✅ El owner esta disponible: se aplican las reglas normales.";

/**
 * Derives the moderation rules for owner-absent mode. When the owner is absent,
 * strict mode and admin consensus (threshold 2) are enabled; otherwise normal
 * rules apply (threshold 1). The note is a user-facing Spanish message.
 * Pure and deterministic.
 */
export const rulesForOwnerAbsent = (ownerAbsent: boolean): OwnerAbsentRules => {
  if (ownerAbsent) {
    return {
      strict: true,
      requireConsensus: true,
      consensusThreshold: 2,
      note: OWNER_ABSENT_NOTE,
    };
  }
  return {
    strict: false,
    requireConsensus: false,
    consensusThreshold: 1,
    note: OWNER_PRESENT_NOTE,
  };
};

/**
 * Decides whether a sensitive moderation action may proceed given the active
 * rules and how many admins approved it. Approvals below zero are treated as
 * zero, and the action is allowed only when approvals meet the threshold.
 * Pure and deterministic.
 */
export const canApplyOwnerAbsentAction = (
  rules: OwnerAbsentRules,
  adminApprovals: number,
): boolean => {
  const safeApprovals = adminApprovals > 0 ? adminApprovals : 0;
  return safeApprovals >= rules.consensusThreshold;
};

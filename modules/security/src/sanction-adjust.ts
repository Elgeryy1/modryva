/**
 * Disciplinary sanction levels ordered from lightest to harshest.
 * Used as the escalation ladder for one-step adjustments.
 * Pure and deterministic.
 */
export type Sanction = "aviso" | "silencio" | "expulsion" | "ban";

/**
 * Direction an admin can nudge a suggested sanction:
 * "suavizar" moves one step down the ladder, "endurecer" moves one step up.
 * Pure and deterministic.
 */
export type AdjustDirection = "suavizar" | "endurecer";

/**
 * Result of nudging a sanction one step along the ladder.
 * "next" is the resulting level (equal to the input when clamped at an end),
 * "changed" is false when already at the boundary for the given direction,
 * and "message" is a ready-to-show Spanish confirmation for the admin.
 * Pure and deterministic.
 */
export interface SanctionAdjustment {
  readonly next: Sanction;
  readonly changed: boolean;
  readonly message: string;
}

/**
 * Escalation ladder from lightest ("aviso") to harshest ("ban").
 * Order is load-bearing for the step arithmetic; do not reorder.
 */
const SANCTION_LADDER: readonly Sanction[] = [
  "aviso",
  "silencio",
  "expulsion",
  "ban",
];

/**
 * User-facing Spanish labels for each sanction, with correct accents.
 * Kept separate from the plain ASCII code identifiers.
 */
const SANCTION_LABELS: Readonly<Record<Sanction, string>> = {
  aviso: "aviso",
  silencio: "silencio",
  expulsion: "expulsión",
  ban: "ban",
};

/**
 * Nudges the suggested sanction one step along the ladder in the given
 * direction. "endurecer" moves toward "ban", "suavizar" moves toward
 * "aviso". At the matching boundary the level is clamped, "changed" is
 * false, and the message explains why. Pure and deterministic.
 */
export const adjustSanction = (
  current: Sanction,
  direction: AdjustDirection,
): SanctionAdjustment => {
  const index = SANCTION_LADDER.indexOf(current);
  const delta = direction === "endurecer" ? 1 : -1;
  const candidate = SANCTION_LADDER[index + delta];
  if (candidate === undefined) {
    const label = SANCTION_LABELS[current];
    const message =
      direction === "endurecer"
        ? `La sanción ya está en el máximo (${label}); no se puede endurecer más.`
        : `La sanción ya está en el mínimo (${label}); no se puede suavizar más.`;
    return { next: current, changed: false, message };
  }
  const message = `Sanción ajustada: ${SANCTION_LABELS[current]} → ${SANCTION_LABELS[candidate]}.`;
  return { next: candidate, changed: true, message };
};

/**
 * Result of scanning for admins who were promoted outside of Modryva.
 * newAdmins lists ids present in the current admin set but absent from the
 * known (Modryva-tracked) set, sorted ascending and deduplicated.
 * alert is true when at least one such id exists.
 * Pure and deterministic.
 */
export interface ExternalPromotionAlert {
  readonly newAdmins: readonly number[];
  readonly alert: boolean;
}

/**
 * Detects admins that appear in currentAdmins but are not in knownAdmins,
 * i.e. someone promoted to admin outside of Modryva. The returned newAdmins
 * are deduplicated and sorted ascending, so the output is stable regardless
 * of input order. alert is true when newAdmins is non-empty.
 * Pure and deterministic.
 */
export const detectExternalPromotions = (
  knownAdmins: readonly number[],
  currentAdmins: readonly number[],
): ExternalPromotionAlert => {
  const known = new Set<number>(knownAdmins);
  const seen = new Set<number>();
  const newAdmins: number[] = [];
  for (const id of currentAdmins) {
    if (!known.has(id) && !seen.has(id)) {
      seen.add(id);
      newAdmins.push(id);
    }
  }
  newAdmins.sort((a, b) => a - b);
  return { newAdmins, alert: newAdmins.length > 0 };
};

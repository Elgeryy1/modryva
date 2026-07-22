/**
 * An admin's decision record: how many actions were confirmed vs reverted.
 * Pure and deterministic.
 */
export interface AdminDecisionRecord {
  readonly adminId: number;
  readonly confirmed: number;
  readonly reverted: number;
}

/**
 * An admin's precision (confirmed / total, rounded to 2 decimals) and their
 * total decisions. Pure and deterministic.
 */
export interface AdminPrecisionRank {
  readonly adminId: number;
  readonly precision: number;
  readonly total: number;
}

/**
 * Ranks admins by decision precision: confirmed decisions over total (confirmed
 * + reverted), rounded to 2 decimals. Sorted by precision descending, then
 * adminId ascending. Admins with no decisions score 0. Pure and deterministic.
 */
export const rankAdminPrecision = (
  admins: readonly AdminDecisionRecord[],
): readonly AdminPrecisionRank[] =>
  admins
    .map((admin) => {
      const total = admin.confirmed + admin.reverted;
      return {
        adminId: admin.adminId,
        precision:
          total === 0 ? 0 : Math.round((admin.confirmed / total) * 100) / 100,
        total,
      };
    })
    .sort((a, b) => {
      if (b.precision !== a.precision) {
        return b.precision - a.precision;
      }
      return a.adminId - b.adminId;
    });

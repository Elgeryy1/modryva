/**
 * Sanction load reported for a single admin. Pure input record.
 * Pure and deterministic.
 */
export interface AdminSanctions {
  /** Telegram user id of the admin. */
  readonly adminId: number;
  /** Total number of sanctions (bans, mutes, kicks) applied by this admin. */
  readonly sanctions: number;
}

/**
 * Tuning options for aggressive-admin detection.
 * Pure and deterministic.
 */
export interface DetectAggressiveOptions {
  /**
   * Multiplier over the average sanction count. An admin is flagged when its
   * sanctions are greater than or equal to avg * factor. Defaults to 2.
   */
  readonly factor?: number;
}

/**
 * A flagged admin together with how many times its sanction count exceeds the
 * team average (ratioToAvg, rounded to 2 decimals).
 * Pure and deterministic.
 */
export interface AggressiveAdmin {
  /** Telegram user id of the flagged admin. */
  readonly adminId: number;
  /** Sanction count of this admin. */
  readonly sanctions: number;
  /** sanctions / average, rounded to 2 decimals. */
  readonly ratioToAvg: number;
}

const DEFAULT_FACTOR = 2;

/**
 * Detects admins that are too aggressive: their sanction count is high compared
 * to the rest of the team. avg is the mean of all sanction counts; an admin is
 * flagged when sanctions >= avg * factor (factor defaults to 2). ratioToAvg is
 * sanctions / avg rounded to 2 decimals. Results are sorted by sanctions
 * descending, ties broken by adminId ascending. Returns an empty list when the
 * input is empty or the average is not positive.
 * Pure and deterministic.
 */
export const detectAggressiveAdmins = (
  admins: readonly AdminSanctions[],
  options?: DetectAggressiveOptions,
): readonly AggressiveAdmin[] => {
  if (admins.length === 0) {
    return [];
  }
  const factor = options?.factor ?? DEFAULT_FACTOR;
  let total = 0;
  for (const admin of admins) {
    total += admin.sanctions;
  }
  const avg = total / admins.length;
  if (avg <= 0) {
    return [];
  }
  const threshold = avg * factor;
  const flagged: AggressiveAdmin[] = [];
  for (const admin of admins) {
    if (admin.sanctions >= threshold) {
      flagged.push({
        adminId: admin.adminId,
        sanctions: admin.sanctions,
        ratioToAvg: Math.round((admin.sanctions / avg) * 100) / 100,
      });
    }
  }
  return flagged.sort((a, b) =>
    b.sanctions !== a.sanctions
      ? b.sanctions - a.sanctions
      : a.adminId - b.adminId,
  );
};

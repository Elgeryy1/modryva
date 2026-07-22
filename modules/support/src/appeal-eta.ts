/**
 * Estimated review time (ETA) for a pending appeal, derived from how many
 * appeals are queued ahead of it and the average time to review a single one.
 *
 * Pure helpers only: no clocks, no randomness. Callers pass plain numbers and
 * receive a numeric ETA plus a user-facing, humanized Spanish label.
 */

/**
 * Input for {@link estimateAppealEta}: the number of appeals waiting ahead in
 * the queue and the average review time per appeal, in milliseconds.
 */
export interface AppealEtaInput {
  /** How many appeals are queued ahead of this one. Non-integer values are floored; negatives and non-finite values count as 0. */
  readonly queueLength: number;
  /** Average time to review a single appeal, in milliseconds. Negatives and non-finite values count as 0. */
  readonly avgReviewMs: number;
}

/**
 * Result of {@link estimateAppealEta}: the raw ETA in milliseconds plus a
 * humanized, user-facing Spanish label describing the wait.
 */
export interface AppealEta {
  /** Estimated wait before review starts, in milliseconds (queueLength * avgReviewMs). */
  readonly etaMs: number;
  /** User-facing Spanish phrase describing the wait, e.g. "en alrededor de 3 minutos". */
  readonly label: string;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Coerces a queue length into a whole non-negative count. Pure and deterministic. */
const toQueueCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Coerces a millisecond duration into a non-negative finite value. Pure and deterministic. */
const toNonNegativeMs = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
};

/**
 * Turns a duration in milliseconds into a short, user-facing Spanish phrase
 * such as "en menos de un minuto", "en alrededor de 2 horas" or "en alrededor
 * de 3 dias" (rendered with correct accents). Non-finite or non-positive
 * inputs yield "de inmediato". Rounds to the nearest whole minute, hour or day.
 * Pure and deterministic.
 */
export const humanizeEtaEs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "de inmediato";
  }
  if (ms < MS_PER_MINUTE) {
    return "en menos de un minuto";
  }
  if (ms < MS_PER_HOUR) {
    const minutes = Math.round(ms / MS_PER_MINUTE);
    return minutes === 1
      ? "en alrededor de un minuto"
      : `en alrededor de ${minutes} minutos`;
  }
  if (ms < MS_PER_DAY) {
    const hours = Math.round(ms / MS_PER_HOUR);
    return hours === 1
      ? "en alrededor de una hora"
      : `en alrededor de ${hours} horas`;
  }
  const days = Math.round(ms / MS_PER_DAY);
  return days === 1 ? "en alrededor de un día" : `en alrededor de ${days} días`;
};

/**
 * Estimates the review ETA for a pending appeal. The ETA is the number of
 * appeals ahead times the average review time; queueLength is floored to a
 * whole count, and negative or non-finite inputs are treated as 0. Returns the
 * numeric ETA in milliseconds and a humanized Spanish label.
 * Pure and deterministic.
 */
export const estimateAppealEta = (input: AppealEtaInput): AppealEta => {
  const etaMs =
    toQueueCount(input.queueLength) * toNonNegativeMs(input.avgReviewMs);
  return { etaMs, label: humanizeEtaEs(etaMs) };
};

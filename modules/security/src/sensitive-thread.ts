/**
 * Signals gathered about a conversation thread that feed the sensitivity score.
 * Counts are coerced to non-negative integers before scoring.
 * Pure and deterministic.
 */
export interface SensitiveThreadSignals {
  /** Number of times the thread has been reported by members. */
  readonly reports: number;
  /** Number of detected conflict events (heated replies, insults, flags). */
  readonly conflicts: number;
}

/**
 * Optional tuning for classifyThreadSensitivity.
 * Pure and deterministic.
 */
export interface SensitiveThreadClassifyOptions {
  /** Minimum score at which a thread is marked sensitive. Defaults to 4. */
  readonly threshold?: number;
}

/**
 * Outcome of classifying a thread's sensitivity.
 * Pure and deterministic.
 */
export interface SensitiveThreadVerdict {
  /** True when the score reaches the configured threshold. */
  readonly sensitive: boolean;
  /** Weighted score: reports * 2 + conflicts. */
  readonly score: number;
}

/** Default score threshold for flagging a thread as sensitive. */
const DEFAULT_SENSITIVE_THRESHOLD = 4;

/** Coerces a raw count into a safe non-negative integer. Internal helper. */
const safeCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Classifies whether a thread should be put under closer observation based on
 * its report and conflict counts. The score weights reports twice as heavily as
 * conflicts (score = reports * 2 + conflicts). Negative, fractional or
 * non-finite counts are sanitized to non-negative integers. A thread is marked
 * sensitive when its score is greater than or equal to the threshold (default 4).
 * Pure and deterministic.
 */
export const classifyThreadSensitivity = (
  input: SensitiveThreadSignals,
  options?: SensitiveThreadClassifyOptions,
): SensitiveThreadVerdict => {
  const reports = safeCount(input.reports);
  const conflicts = safeCount(input.conflicts);
  const score = reports * 2 + conflicts;
  const rawThreshold = options?.threshold;
  const threshold =
    rawThreshold !== undefined && Number.isFinite(rawThreshold)
      ? rawThreshold
      : DEFAULT_SENSITIVE_THRESHOLD;
  return { sensitive: score >= threshold, score };
};

/**
 * Builds a short Spanish status line for a sensitivity verdict, suitable for an
 * admin notice. Emoji included for quick scanning.
 * Pure and deterministic.
 */
export const describeThreadSensitivity = (
  verdict: SensitiveThreadVerdict,
): string => {
  if (verdict.sensitive) {
    return `🔍 Hilo bajo observación: puntuación de sensibilidad ${verdict.score}.`;
  }
  return `✅ Hilo sin señales de riesgo: puntuación ${verdict.score}.`;
};

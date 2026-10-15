/**
 * Observed volume of logged data backing a metric, used to judge reliability.
 * `sampleSize` is the count of individual log records; `daysCovered` is the
 * span of distinct days those records touch.
 */
export interface DataQualityInput {
  readonly sampleSize: number;
  readonly daysCovered: number;
}

/**
 * Optional minimum thresholds for a reliable metric. Both are inclusive floors:
 * a value equal to the threshold is considered sufficient.
 */
export interface DataQualityThresholds {
  readonly minSample?: number;
  readonly minDays?: number;
}

/**
 * Verdict on whether the underlying data is dense enough to trust a metric.
 * `reasons` holds user-facing Spanish warnings (empty when reliable), in a
 * stable order: sample-size issue first, then coverage-days issue.
 */
export interface DataQualityAssessment {
  readonly reliable: boolean;
  readonly reasons: readonly string[];
}

/** Default minimum number of log records for a trustworthy metric. */
const DEFAULT_MIN_SAMPLE = 30;

/** Default minimum number of covered days for a trustworthy metric. */
const DEFAULT_MIN_DAYS = 7;

/**
 * Picks the singular or plural noun for a count. Internal helper.
 * Pure and deterministic.
 */
const pluralNoun = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

/**
 * Assesses whether there are enough logs, over enough days, to trust a metric.
 * A count is insufficient when it is below (strictly less than) the resolved
 * threshold; non-finite inputs are treated as insufficient. Reasons are
 * user-facing Spanish strings and always appear in a fixed order (sample first,
 * days second), so the output is stable for identical inputs.
 * Pure and deterministic.
 */
export const assessDataQuality = (
  input: DataQualityInput,
  thresholds?: DataQualityThresholds,
): DataQualityAssessment => {
  const minSample = thresholds?.minSample ?? DEFAULT_MIN_SAMPLE;
  const minDays = thresholds?.minDays ?? DEFAULT_MIN_DAYS;

  const reasons: string[] = [];

  const sampleOk =
    Number.isFinite(input.sampleSize) && input.sampleSize >= minSample;
  if (!sampleOk) {
    const noun = pluralNoun(input.sampleSize, "registro", "registros");
    reasons.push(
      `⚠️ Muestra insuficiente: ${input.sampleSize} ${noun} (mínimo ${minSample}).`,
    );
  }

  const daysOk =
    Number.isFinite(input.daysCovered) && input.daysCovered >= minDays;
  if (!daysOk) {
    const noun = pluralNoun(input.daysCovered, "día", "días");
    reasons.push(
      `⚠️ Período insuficiente: ${input.daysCovered} ${noun} (mínimo ${minDays}).`,
    );
  }

  return { reliable: reasons.length === 0, reasons };
};

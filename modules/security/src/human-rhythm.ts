/**
 * Verdict describing whether a sequence of message timestamps looks
 * mechanically regular (a likely bot) rather than humanly irregular.
 * Pure and deterministic.
 */
export interface RhythmVerdict {
  /** True when the rhythm is too regular to be human. */
  readonly suspicious: boolean;
  /** Number of intervals analysed (one less than the timestamp count). */
  readonly intervalCount: number;
  /** Population standard deviation of the intervals, rounded to an integer of milliseconds. */
  readonly stdDevMs: number;
}

/**
 * Tuning knobs for detectInhumanRhythm. Both fields are optional and fall
 * back to sane defaults when omitted.
 * Pure and deterministic.
 */
export interface RhythmOptions {
  /** Minimum number of intervals required before a verdict can be suspicious. Default 4. */
  readonly minSamples?: number;
  /** Interval standard deviation (ms) at or above which the rhythm is considered human. Default 300. */
  readonly maxStdDevMs?: number;
}

const DEFAULT_MIN_SAMPLES = 4;
const DEFAULT_MAX_STD_DEV_MS = 300;

/**
 * Detects an inhuman (bot-like) posting rhythm from message timestamps.
 * The timestamps are sorted ascending, the gaps between consecutive
 * messages are measured, and their population standard deviation is
 * computed. A rhythm is flagged as suspicious when there are at least
 * `minSamples` intervals AND their rounded standard deviation is strictly
 * below `maxStdDevMs` (very regular gaps betray automation).
 * Pure and deterministic.
 */
export const detectInhumanRhythm = (
  timestampsMs: readonly number[],
  options?: RhythmOptions,
): RhythmVerdict => {
  const minSamples = options?.minSamples ?? DEFAULT_MIN_SAMPLES;
  const maxStdDevMs = options?.maxStdDevMs ?? DEFAULT_MAX_STD_DEV_MS;

  const sorted = [...timestampsMs].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1] ?? 0;
    const curr = sorted[i] ?? 0;
    intervals.push(curr - prev);
  }

  const intervalCount = intervals.length;
  if (intervalCount === 0) {
    return { suspicious: false, intervalCount: 0, stdDevMs: 0 };
  }

  let sum = 0;
  for (const value of intervals) {
    sum += value;
  }
  const mean = sum / intervalCount;

  let squaredSum = 0;
  for (const value of intervals) {
    const delta = value - mean;
    squaredSum += delta * delta;
  }
  const variance = squaredSum / intervalCount;
  const stdDevMs = Math.round(Math.sqrt(variance));

  const suspicious = intervalCount >= minSamples && stdDevMs < maxStdDevMs;
  return { suspicious, intervalCount, stdDevMs };
};

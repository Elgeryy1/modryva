/**
 * A single moderated message reduced to whether it reads as aggressive.
 * Pure and deterministic.
 */
export interface ToneSample {
  readonly aggressive: boolean;
}

/**
 * Tuning for tone-shift detection.
 * Pure and deterministic.
 */
export interface ToneShiftOptions {
  /** How many consecutive calm messages must precede the aggressive one. Defaults to 3. */
  readonly calmWindow?: number;
}

/**
 * Result of analysing a message history for a sudden aggressive turn.
 * Pure and deterministic.
 */
export interface ToneShiftResult {
  /** True when a calm streak is broken by an aggressive last message. */
  readonly shifted: boolean;
  /** Count of consecutive calm messages immediately before the last one. */
  readonly calmBefore: number;
}

const DEFAULT_CALM_WINDOW = 3;

/**
 * Detects an abrupt tone shift: a normally calm author who suddenly turns
 * aggressive. Returns `shifted: true` only when the last sample is aggressive
 * and the immediately preceding `calmWindow` samples were all non-aggressive.
 * `calmBefore` always reports the trailing calm streak before the last sample,
 * independent of whether a shift was flagged. Empty history yields no shift.
 * Pure and deterministic.
 */
export const detectToneShift = (
  history: readonly ToneSample[],
  options?: ToneShiftOptions,
): ToneShiftResult => {
  const rawWindow = options?.calmWindow ?? DEFAULT_CALM_WINDOW;
  const calmWindow = rawWindow < 0 ? 0 : rawWindow;

  if (history.length === 0) {
    return { shifted: false, calmBefore: 0 };
  }

  const lastIndex = history.length - 1;
  const last = history[lastIndex] ?? { aggressive: false };

  let calmBefore = 0;
  for (let i = lastIndex - 1; i >= 0; i -= 1) {
    const sample = history[i] ?? { aggressive: false };
    if (sample.aggressive) {
      break;
    }
    calmBefore += 1;
  }

  const shifted = last.aggressive && calmBefore >= calmWindow;
  return { shifted, calmBefore };
};

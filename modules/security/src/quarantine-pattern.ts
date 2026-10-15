/**
 * Signal names that can contribute to a quarantine decision.
 * Order here defines the order they appear in the result. Pure and deterministic.
 */
export type QuarantineSignal = "noPhoto" | "oddName" | "quickLink";

/**
 * Inputs describing the classic spam-account profile: no profile photo,
 * a weird/random display name, and a link posted very soon after joining.
 * Pure and deterministic.
 */
export interface QuarantinePatternInput {
  readonly hasPhoto: boolean;
  readonly oddName: boolean;
  readonly quickLink: boolean;
}

/**
 * Tuning for the quarantine decision. minSignals is the number of matched
 * signals required to quarantine (default 2). Pure and deterministic.
 */
export interface QuarantinePatternOptions {
  readonly minSignals?: number;
}

/**
 * Outcome of evaluating the spam pattern: whether to quarantine and which
 * signals fired, in QuarantineSignal order. Pure and deterministic.
 */
export interface QuarantinePatternDecision {
  readonly quarantine: boolean;
  readonly signals: readonly QuarantineSignal[];
}

const DEFAULT_MIN_SIGNALS = 2;

/**
 * Decides whether a user matches the typical spam profile (no photo + odd name
 * + quick link) and should be quarantined. A signal fires when: hasPhoto is
 * false (noPhoto), oddName is true, or quickLink is true. Quarantines when the
 * number of fired signals reaches minSignals (default 2). Signals are returned
 * in a fixed order: noPhoto, oddName, quickLink. Pure and deterministic.
 */
export const decideQuarantine = (
  input: QuarantinePatternInput,
  options?: QuarantinePatternOptions,
): QuarantinePatternDecision => {
  const rawMin = options?.minSignals ?? DEFAULT_MIN_SIGNALS;
  const minSignals = rawMin < 0 ? 0 : rawMin;

  const signals: QuarantineSignal[] = [];
  if (!input.hasPhoto) {
    signals.push("noPhoto");
  }
  if (input.oddName) {
    signals.push("oddName");
  }
  if (input.quickLink) {
    signals.push("quickLink");
  }

  return { quarantine: signals.length >= minSignals, signals };
};

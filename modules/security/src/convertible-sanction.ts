/**
 * Input for a convertible sanction evaluation: the original mute duration in
 * milliseconds and whether the user accepted the offered rule.
 * Pure and deterministic.
 */
export interface ConvertibleSanctionInput {
  readonly muteMs: number;
  readonly acceptsRule: boolean;
}

/**
 * Tuning for a convertible sanction. reductionRatio is the fraction of the
 * mute removed when the user accepts the rule (0 = no reduction, 1 = full
 * pardon). Defaults to 0.5 and is clamped to the [0, 1] range.
 * Pure and deterministic.
 */
export interface ConvertibleSanctionOptions {
  readonly reductionRatio?: number;
}

/**
 * Outcome of a convertible sanction: the resulting mute, how much time was
 * removed, and a user-facing Spanish message describing the decision.
 * Pure and deterministic.
 */
export interface ConvertibleSanctionOutcome {
  readonly newMuteMs: number;
  readonly reducedMs: number;
  readonly message: string;
}

const DEFAULT_REDUCTION_RATIO = 0.5;

const sanitizeMuteMs = (muteMs: number): number => {
  if (!Number.isFinite(muteMs) || muteMs <= 0) {
    return 0;
  }
  return Math.round(muteMs);
};

const sanitizeRatio = (ratio: number | undefined): number => {
  if (ratio === undefined || !Number.isFinite(ratio)) {
    return DEFAULT_REDUCTION_RATIO;
  }
  if (ratio < 0) {
    return 0;
  }
  if (ratio > 1) {
    return 1;
  }
  return ratio;
};

/**
 * Evaluates a convertible sanction: a long mute that can be shortened when the
 * user accepts a rule. When acceptsRule is true, the new mute is
 * round(muteMs * (1 - reductionRatio)) and reducedMs is the time removed;
 * otherwise the mute is kept intact and reducedMs is 0. Non-finite or negative
 * muteMs is treated as 0, and reductionRatio is clamped to [0, 1] (default 0.5).
 * Pure and deterministic.
 */
export const convertSanction = (
  input: ConvertibleSanctionInput,
  options?: ConvertibleSanctionOptions,
): ConvertibleSanctionOutcome => {
  const originalMs = sanitizeMuteMs(input.muteMs);
  const ratio = sanitizeRatio(options?.reductionRatio);

  if (!input.acceptsRule) {
    return {
      newMuteMs: originalMs,
      reducedMs: 0,
      message:
        `⏳ Si aceptas la norma, tu sanción podría reducirse. ` +
        `Por ahora se mantiene en ${originalMs} ms.`,
    };
  }

  const newMuteMs = Math.round(originalMs * (1 - ratio));
  const reducedMs = originalMs - newMuteMs;

  return {
    newMuteMs,
    reducedMs,
    message:
      `✅ Gracias por aceptar la norma. Tu sanción baja de ${originalMs} ` +
      `a ${newMuteMs} ms (${reducedMs} ms menos).`,
  };
};

/**
 * Activity counts used to decide whether a volume spike warrants extra
 * protection. Pure and deterministic.
 */
export interface VolumeTriggerInput {
  readonly baseline: number;
  readonly current: number;
}

/** Options for shouldActivateVolumeProtection. */
export interface VolumeTriggerOptions {
  readonly spikeRatio?: number;
}

/**
 * Whether extra protection should switch on, plus the observed spike ratio.
 * Pure and deterministic.
 */
export interface VolumeTriggerResult {
  readonly activate: boolean;
  readonly ratio: number;
}

const DEFAULT_SPIKE_RATIO = 3;

/** Rounds to 2 decimals. Pure and deterministic. */
const roundVolumeRatio = (value: number): number =>
  Math.round(value * 100) / 100;

/**
 * Decides whether to activate extra protection when activity spikes. The ratio
 * is current/baseline rounded to 2 decimals; a baseline of zero yields a ratio
 * of 0 (nothing to compare against). Protection activates when the ratio meets
 * spikeRatio (default 3, i.e. a 300% surge). Pure and deterministic.
 */
export const shouldActivateVolumeProtection = (
  input: VolumeTriggerInput,
  options?: VolumeTriggerOptions,
): VolumeTriggerResult => {
  const spikeRatio = options?.spikeRatio ?? DEFAULT_SPIKE_RATIO;
  if (input.baseline <= 0) {
    return { activate: false, ratio: 0 };
  }
  const ratio = roundVolumeRatio(input.current / input.baseline);
  return { activate: ratio >= spikeRatio, ratio };
};

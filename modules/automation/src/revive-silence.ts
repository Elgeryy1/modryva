/**
 * Input for the silence-revival automation: how many minutes have elapsed
 * since the last message was seen in the group.
 * Pure and deterministic.
 */
export interface ReviveSilenceInput {
  readonly minutesSinceLastMessage: number;
}

/**
 * Tuning knobs for the silence-revival automation. quietThresholdMin is the
 * number of quiet minutes required before a soft icebreaker is proposed.
 * Pure and deterministic.
 */
export interface ReviveSilenceOptions {
  readonly quietThresholdMin?: number;
}

/**
 * Decision produced by checkReviveSilence: whether to nudge the group and the
 * user-facing Spanish icebreaker to post (empty string when revive is false).
 * Pure and deterministic.
 */
export interface ReviveSilenceDecision {
  readonly revive: boolean;
  readonly prompt: string;
}

const DEFAULT_QUIET_THRESHOLD_MIN = 120;

/**
 * Soft icebreakers, ordered by escalating silence. The longer the group has
 * been quiet, the later (more playful) the prompt selected.
 * Pure and deterministic.
 */
const REVIVE_SILENCE_ICEBREAKERS: readonly string[] = [
  "El grupo esta muy callado 🤔 ¿Cual ha sido lo mejor de vuestro dia?",
  "¡Silencio total por aqui! 🎉 Si fueras un emoji ahora mismo, ¿cual serias?",
  "Se nota tranquilo el chat 😴 ¿Alguien recomienda una serie o pelicula para esta noche?",
];

const resolveThreshold = (raw: number | undefined): number => {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_QUIET_THRESHOLD_MIN;
  }
  return raw;
};

const pickIcebreaker = (minutes: number, threshold: number): string => {
  const bucket = Math.floor(minutes / threshold) - 1;
  const clamped = Math.max(
    0,
    Math.min(REVIVE_SILENCE_ICEBREAKERS.length - 1, bucket),
  );
  const fallback = REVIVE_SILENCE_ICEBREAKERS[0] ?? "";
  return REVIVE_SILENCE_ICEBREAKERS[clamped] ?? fallback;
};

/**
 * Decides whether a dormant group should receive a gentle icebreaker. A group
 * is considered dormant once minutesSinceLastMessage reaches or exceeds
 * quietThresholdMin (default 120). Non-finite or negative inputs, and invalid
 * thresholds, are treated safely (no revive / default threshold). When revive
 * is true, a Spanish icebreaker is selected, escalating with the silence
 * length. When false, prompt is an empty string.
 * Pure and deterministic.
 */
export const checkReviveSilence = (
  input: ReviveSilenceInput,
  options?: ReviveSilenceOptions,
): ReviveSilenceDecision => {
  const threshold = resolveThreshold(options?.quietThresholdMin);
  const minutes = input.minutesSinceLastMessage;
  if (!Number.isFinite(minutes) || minutes < 0) {
    return { revive: false, prompt: "" };
  }
  if (minutes < threshold) {
    return { revive: false, prompt: "" };
  }
  return { revive: true, prompt: pickIcebreaker(minutes, threshold) };
};

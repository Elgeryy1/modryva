/**
 * Input describing a pending broadcast: how many groups it will reach,
 * how many of those it will be pinned in, and whether it is sent silently.
 * Pure and deterministic.
 */
export interface PublishSummaryInput {
  readonly groups: number;
  readonly pinIn: number;
  readonly silent: boolean;
}

/**
 * Normalizes a possibly fractional or negative count into a non-negative integer.
 * Internal helper. Pure and deterministic.
 */
const toCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Builds one confirmation sentence (Spanish) shown before publishing a broadcast,
 * e.g. "Vas a enviar esto a 4 grupos y fijarlo en 2, sin notificacion." Counts are
 * clamped to non-negative integers, pinIn is capped at groups, and zero groups yields
 * a warning. Pure and deterministic.
 */
export const buildPublishSummary = (input: PublishSummaryInput): string => {
  const groups = toCount(input.groups);
  if (groups === 0) {
    return "🚫 No hay ningún grupo seleccionado para publicar.";
  }
  const pinIn = Math.min(toCount(input.pinIn), groups);
  const groupWord = groups === 1 ? "grupo" : "grupos";
  let sentence = `📢 Vas a enviar esto a ${groups} ${groupWord}`;
  if (pinIn > 0) {
    sentence += ` y fijarlo en ${pinIn}`;
  }
  sentence += input.silent ? ", sin notificación." : ".";
  return sentence;
};

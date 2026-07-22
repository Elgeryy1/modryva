/**
 * Verdict for the observe-only diagnosis: 'tranquilo' (calm), 'vigilar'
 * (keep watching) or 'intervenir' (recommend acting). Pure and deterministic.
 */
export type ObservationVerdict = "tranquilo" | "vigilar" | "intervenir";

/**
 * Counts gathered while the bot only observes a chat, without acting.
 * All fields are absolute counts over the same observation window.
 * Pure and deterministic.
 */
export interface ObservationDiagnosisInput {
  /** Total messages observed in the window. */
  readonly messages: number;
  /** Messages flagged as conflict or hostility. */
  readonly conflicts: number;
  /** Messages flagged as spam. */
  readonly spam: number;
}

/**
 * Diagnosis produced after an observe-only window: a machine verdict plus a
 * ready-to-send user-facing Spanish summary. Pure and deterministic.
 */
export interface ObservationDiagnosis {
  /** Recommended stance derived from the conflict and spam ratios. */
  readonly verdict: ObservationVerdict;
  /** User-facing Spanish summary explaining the verdict. */
  readonly summary: string;
}

/** Ratio at or above which the window warrants active intervention. */
const INTERVENE_RATIO = 0.25;

/** Ratio at or above which the window warrants closer watching. */
const WATCH_RATIO = 0.1;

/** Clamps a possibly negative or fractional count to a non-negative integer. */
const clampCount = (value: number): number =>
  value > 0 ? Math.floor(value) : 0;

/**
 * Builds an observe-only diagnosis from raw observation counts. The bot never
 * intervenes here: it only classifies the window into a verdict and composes a
 * Spanish summary. Negative or fractional counts are clamped to non-negative
 * integers, and ratios are computed against the observed message total (zero
 * messages yields a calm verdict). Pure and deterministic.
 */
export const buildObservationDiagnosis = (
  input: ObservationDiagnosisInput,
): ObservationDiagnosis => {
  const messages = clampCount(input.messages);
  const conflicts = clampCount(input.conflicts);
  const spam = clampCount(input.spam);

  const conflictRatio = messages > 0 ? conflicts / messages : 0;
  const spamRatio = messages > 0 ? spam / messages : 0;
  const worstRatio = Math.max(conflictRatio, spamRatio);

  const tail = `observe ${messages} mensajes, ${conflicts} conflictos y ${spam} de spam`;

  if (worstRatio >= INTERVENE_RATIO) {
    return {
      verdict: "intervenir",
      summary: `🔴 Recomiendo intervenir: ${tail}. Los niveles superan el umbral seguro y conviene actuar.`,
    };
  }
  if (worstRatio >= WATCH_RATIO) {
    return {
      verdict: "vigilar",
      summary: `🟡 Conviene vigilar: ${tail}. Sigo observando sin intervenir, atento a que empeore.`,
    };
  }
  return {
    verdict: "tranquilo",
    summary: `🟢 Todo tranquilo: ${tail}. No hace falta intervenir por ahora.`,
  };
};

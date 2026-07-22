/**
 * Input for the sanction-effect prediction. `severity` is a 0..10 harshness
 * scale (values outside are clamped), `userTenureDays` is how long the user has
 * been in the community, and `hasSupporters` flags whether the user has visible
 * allies who might rally around them. Pure and deterministic.
 */
export interface SanctionEffectInput {
  readonly severity: number;
  readonly userTenureDays: number;
  readonly hasSupporters: boolean;
}

/**
 * Predicted outcome of applying a sanction: whether it will calm the conflict
 * (`calma`), have little effect (`neutral`), or escalate it (`empeora`), plus
 * the integer heuristic `score` (higher means more likely to escalate).
 * Pure and deterministic.
 */
export interface SanctionEffectPrediction {
  readonly effect: "calma" | "neutral" | "empeora";
  readonly score: number;
}

/** Clamps a severity value into the supported 0..10 range. Pure and deterministic. */
const clampSeverity = (severity: number): number => {
  if (severity < 0) {
    return 0;
  }
  if (severity > 10) {
    return 10;
  }
  return severity;
};

/**
 * Estimates whether a sanction will calm or worsen a conflict. Harsh sanctions
 * against veteran users or users with supporters push the score toward
 * `empeora`; light sanctions (severity <= 3) pull it toward `calma`. The score
 * is a rounded integer: <= 20 is `calma`, >= 55 is `empeora`, anything in
 * between is `neutral`. Pure and deterministic.
 */
export const predictSanctionEffect = (
  input: SanctionEffectInput,
): SanctionEffectPrediction => {
  const s = clampSeverity(input.severity);
  const tenure = input.userTenureDays < 0 ? 0 : input.userTenureDays;
  const tenureFactor = Math.min(tenure, 365) / 365;

  let raw = s * 8;
  if (input.hasSupporters) {
    raw += 25;
  }
  raw += tenureFactor * 20;
  if (s <= 3) {
    raw -= 35;
  }

  const score = Math.round(raw);
  const effect: SanctionEffectPrediction["effect"] =
    score <= 20 ? "calma" : score >= 55 ? "empeora" : "neutral";

  return { effect, score };
};

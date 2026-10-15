/** Activity before and after a rule change. Pure and deterministic. */
export interface RuleActivityInput {
  readonly before: number;
  readonly after: number;
}

/**
 * The effect of a rule on activity: absolute delta, percent change and a
 * user-facing direction. Pure and deterministic.
 */
export interface RuleActivityEffect {
  readonly delta: number;
  readonly pct: number;
  readonly effect: "subio" | "bajo" | "sin_cambio";
}

/**
 * Measures how a new rule affected activity by comparing before and after
 * counts. pct is the percent change relative to before (0 when before is 0).
 * Pure and deterministic.
 */
export const computeRuleActivityEffect = (
  input: RuleActivityInput,
): RuleActivityEffect => {
  const delta = input.after - input.before;
  const pct = input.before === 0 ? 0 : Math.round((delta / input.before) * 100);
  const effect = delta > 0 ? "subio" : delta < 0 ? "bajo" : "sin_cambio";
  return { delta, pct, effect };
};

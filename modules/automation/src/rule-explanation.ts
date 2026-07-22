/**
 * Minimum number of characters (after trimming) required for a rule
 * explanation to be considered a valid justification.
 * Pure and deterministic.
 */
const MIN_EXPLANATION_LENGTH = 10;

/**
 * Input for validateRuleExplanation: an automation rule that must carry a
 * human-readable reason for why it exists.
 * Pure and deterministic.
 */
export interface RuleExplanationInput {
  readonly name: string;
  readonly explanation: string;
}

/**
 * Result of validating a rule explanation. When valid is false, issue holds a
 * user-facing Spanish message describing what is missing; when valid is true,
 * issue is omitted.
 * Pure and deterministic.
 */
export interface RuleExplanationCheck {
  readonly valid: boolean;
  readonly issue?: string;
}

/**
 * Builds a safe display label for a rule name, falling back to a placeholder
 * when the name is blank. Internal helper, not exported.
 * Pure and deterministic.
 */
const ruleDisplayLabel = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "sin nombre";
};

/**
 * Validates that an automation rule carries a mandatory explanation of why it
 * exists. The explanation is considered valid when its trimmed length is at
 * least MIN_EXPLANATION_LENGTH characters. Returns a user-facing Spanish issue
 * when the explanation is missing or too short, and omits issue when valid.
 * Pure and deterministic.
 */
export const validateRuleExplanation = (
  rule: RuleExplanationInput,
): RuleExplanationCheck => {
  const explanation = rule.explanation.trim();
  const label = ruleDisplayLabel(rule.name);
  if (explanation.length === 0) {
    return {
      valid: false,
      issue: `La regla «${label}» debe explicar por qué existe: la explicación no puede estar vacía. ✍️`,
    };
  }
  if (explanation.length < MIN_EXPLANATION_LENGTH) {
    return {
      valid: false,
      issue: `La explicación de la regla «${label}» es demasiado corta: se requieren al menos ${MIN_EXPLANATION_LENGTH} caracteres. ✍️`,
    };
  }
  return { valid: true };
};

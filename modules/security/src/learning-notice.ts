/**
 * Input for building a learning-oriented warning notice: the rule that was
 * broken and a short concrete example of the offending behaviour.
 */
export interface LearningNoticeInput {
  /** Short description of the rule the user broke. */
  readonly rule: string;
  /** Concrete example illustrating the rule violation. */
  readonly example: string;
}

const HEADER = "📚 Nota de aprendizaje";
const INTRO = "Has recibido una advertencia para que puedas mejorar.";
const CLOSING = "Revísala con calma y evitarás nuevas sanciones. 🙌";
const RULE_FALLBACK = "la norma del grupo";

/**
 * Builds a short, friendly Spanish notice shown to a user right after a warn,
 * explaining which rule was broken and giving a concrete example. Inputs are
 * trimmed; an empty rule falls back to a generic phrase and an empty example
 * simply omits the example line. The line order is always stable.
 * Pure and deterministic.
 */
export const buildLearningNotice = (input: LearningNoticeInput): string => {
  const rule = input.rule.trim();
  const example = input.example.trim();
  const ruleText = rule.length > 0 ? rule : RULE_FALLBACK;
  const lines: string[] = [HEADER, INTRO, `Norma: ${ruleText}`];
  if (example.length > 0) {
    lines.push(`Ejemplo: ${example}`);
  }
  lines.push(CLOSING);
  return lines.join("\n");
};

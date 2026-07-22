/**
 * Input for buildAppealLearning: the outcome of a moderation appeal and the
 * rule it concerned. Pure data, no side effects.
 */
export interface AppealLearningInput {
  /** True when the appeal was accepted (the sanction is reverted). */
  readonly accepted: boolean;
  /** Human-readable name of the rule the appeal was about. */
  readonly rule: string;
}

/**
 * Builds the user-facing label for a rule, quoting it when present or falling
 * back to a neutral phrase when the rule name is blank.
 * Internal helper, unexported. Pure and deterministic.
 */
const ruleLabel = (rule: string): string => {
  const trimmed = rule.trim();
  return trimmed.length > 0 ? `la regla «${trimmed}»` : "la regla aplicada";
};

/**
 * Builds the closing message for a moderation appeal that includes a learning
 * note. When accepted, it acknowledges the mistake and promises to refine the
 * rule; when rejected, it politely upholds the sanction. The rule name is
 * trimmed and quoted, with a neutral fallback for blank names.
 * Pure and deterministic.
 */
export const buildAppealLearning = (input: AppealLearningInput): string => {
  const label = ruleLabel(input.rule);
  if (input.accepted) {
    return `✅ Apelación aceptada. Hemos aprendido de este caso y ajustaremos ${label} para evitar errores futuros. ¡Gracias por ayudarnos a mejorar! 🙌`;
  }
  return `❌ Apelación rechazada. Tras revisarla, la sanción se mantiene porque ${label} se aplicó correctamente. Gracias por tu comprensión. 🙏`;
};

/**
 * Input for building a post-conflict coexistence agreement between two users.
 * Both user labels are shown verbatim (already-formatted mentions or names).
 * Pure and deterministic.
 */
export interface CoexistenceAgreementInput {
  readonly userA: string;
  readonly userB: string;
  readonly rules: readonly string[];
}

/**
 * Trims, drops empty entries and deduplicates rules while preserving first-seen
 * order. Internal helper, not exported. Pure and deterministic.
 */
const sanitizeAgreementRules = (rules: readonly string[]): string[] => {
  const out: string[] = [];
  for (const rule of rules) {
    const trimmed = rule.trim();
    if (trimmed.length > 0 && !out.includes(trimmed)) {
      out.push(trimmed);
    }
  }
  return out;
};

/**
 * Builds a user-facing Spanish coexistence-agreement message naming both users
 * and listing the agreed minimal rules as a bullet list. Rules are trimmed,
 * deduplicated and kept in first-seen order; blank user labels fall back to
 * generic placeholders. When no valid rule remains, a warning message is
 * returned instead of the bullet list. Pure and deterministic.
 */
export const buildCoexistenceAgreement = (
  input: CoexistenceAgreementInput,
): string => {
  const userA =
    input.userA.trim().length > 0 ? input.userA.trim() : "Usuario A";
  const userB =
    input.userB.trim().length > 0 ? input.userB.trim() : "Usuario B";
  const rules = sanitizeAgreementRules(input.rules);
  const header = `🤝 Acuerdo de convivencia entre ${userA} y ${userB}`;
  if (rules.length === 0) {
    return `${header}\n\n⚠️ No se definieron reglas mínimas para este acuerdo.`;
  }
  const body = rules.map((rule) => `• ${rule}`).join("\n");
  return `${header}\n\nPara seguir participando, ambos aceptan estas reglas mínimas:\n${body}\n\nSi alguien rompe el acuerdo, la moderación podrá intervenir. 🕊️`;
};

/**
 * A single sampled message annotated with whether a candidate rule would match it.
 * Pure data input; no Telegram or domain types involved.
 */
export interface RuleImpactSample {
  readonly matchesRule: boolean;
}

/**
 * Impact assessment of a candidate rule over a sample of recent messages:
 * how many it would have affected, the total sampled, the affected ratio
 * (rounded to 2 decimals, 0 when there is no sample) and a user-facing
 * Spanish summary line.
 */
export interface RuleImpactAssessment {
  readonly affected: number;
  readonly total: number;
  readonly ratio: number;
  readonly summary: string;
}

/**
 * Picks the correct Spanish noun form for a message count.
 * Internal helper, not exported to avoid barrel symbol clashes.
 */
const messageNoun = (count: number): string =>
  count === 1 ? "mensaje" : "mensajes";

/**
 * Computes how many sampled messages a candidate rule would have affected this
 * week, plus the affected ratio and a ready-to-send Spanish summary.
 * The ratio is affected/total rounded to 2 decimals, and is 0 when the sample
 * is empty (guarding against division by zero). The percentage shown in the
 * summary is derived from the rounded ratio. Pure and deterministic.
 */
export const computeRuleImpact = (
  sampleMessages: readonly RuleImpactSample[],
): RuleImpactAssessment => {
  const total = sampleMessages.length;
  let affected = 0;
  for (const message of sampleMessages) {
    if (message.matchesRule) {
      affected += 1;
    }
  }

  if (total === 0) {
    return {
      affected: 0,
      total: 0,
      ratio: 0,
      summary:
        "Sin mensajes de muestra: no se puede estimar el impacto de la regla.",
    };
  }

  const ratio = Math.round((affected / total) * 100) / 100;
  const percent = Math.round(ratio * 100);

  if (affected === 0) {
    return {
      affected,
      total,
      ratio,
      summary: `Esta regla no habría afectado a ningún mensaje (0 de ${total}) esta semana.`,
    };
  }

  const summary = `Esta regla habría afectado a ${affected} de ${total} ${messageNoun(
    total,
  )} (${percent}%) esta semana.`;

  return { affected, total, ratio, summary };
};

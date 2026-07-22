/**
 * Structured input for a post-launch report: total reach plus the two
 * engagement signals (reactions and questions received).
 * Pure and deterministic.
 */
export interface PostLaunchInput {
  readonly reach: number;
  readonly reactions: number;
  readonly questions: number;
}

/**
 * Computed post-launch report: the engagement ratio (0..1, rounded to two
 * decimals) plus a user-facing Spanish summary.
 * Pure and deterministic.
 */
export interface PostLaunchReport {
  readonly engagementRate: number;
  readonly summary: string;
}

/**
 * Picks a short user-facing Spanish label describing the engagement level
 * for a given rate (0..1), assuming reach was positive.
 * Pure and deterministic.
 */
const engagementLabel = (rate: number): string => {
  if (rate >= 0.5) {
    return "excelente";
  }
  if (rate >= 0.2) {
    return "buena";
  }
  if (rate > 0) {
    return "mejorable";
  }
  return "sin interacción";
};

/**
 * Builds a post-launch report from reach and engagement counts. The
 * engagementRate is (reactions + questions) / reach rounded to two decimals,
 * guarded to 0 when reach is not positive. The summary is user-facing Spanish.
 * Pure and deterministic.
 */
export const buildPostLaunchReport = (
  input: PostLaunchInput,
): PostLaunchReport => {
  const { reach, reactions, questions } = input;
  const interactions = reactions + questions;
  if (reach <= 0) {
    return {
      engagementRate: 0,
      summary: "📊 Informe post-lanzamiento: sin alcance registrado todavía.",
    };
  }
  const engagementRate = Math.round((interactions / reach) * 100) / 100;
  const pct = Math.round(engagementRate * 100);
  const label = engagementLabel(engagementRate);
  const summary =
    `📊 Informe post-lanzamiento: alcance de ${reach}, ${reactions} reacciones ` +
    `y ${questions} preguntas. Participación ${pct}% (${label}).`;
  return { engagementRate, summary };
};

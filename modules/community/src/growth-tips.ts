/**
 * Snapshot of a community used to derive responsible-growth advice.
 * All counters are weekly aggregates and are expected to be non-negative.
 */
export interface GrowthTipsState {
  /** Current total number of members in the community. */
  readonly members: number;
  /** Number of moderation conflicts detected in the last 7 days. */
  readonly weeklyConflicts: number;
  /** Number of new members joined in the last 7 days. */
  readonly weeklyJoins: number;
}

const TIP_DRAMA =
  "⚖️ Hay demasiados conflictos esta semana. Publica reglas claras y usa avisos antes de expulsar para reducir el drama.";
const TIP_RAPID =
  "🚀 Estás creciendo muy rápido. Da la bienvenida a cada nuevo miembro y refuerza la moderación para evitar spam.";
const TIP_STAGNANT =
  "🌱 El crecimiento está estancado. Comparte contenido de valor e invita a miembros afines para crecer de forma responsable.";
const TIP_SMALL =
  "🤝 Tu comunidad es pequeña todavía. Concéntrate en conversaciones de calidad y en construir confianza antes de escalar.";

const GENERAL_TIPS: readonly string[] = [
  "📌 Mantén fijado un mensaje con las normas para que todos las conozcan.",
  "💬 Fomenta conversaciones respetuosas y agradece a quienes ayudan a los demás.",
];

const MIN_TIPS = 2;
const MAX_TIPS = 4;
const SMALL_COMMUNITY_MEMBERS = 50;

/**
 * Suggests 2 to 4 responsible-growth and drama-reduction tips based on a
 * community state. Signal-specific tips are emitted in a fixed priority order
 * (conflicts, rapid growth, stagnation, small size); if fewer than 2 signals
 * fire, generic best-practice tips fill the list up to the minimum. The result
 * is capped at 4 tips. Spanish, user-facing, deduplicated.
 * Pure and deterministic.
 */
export const suggestGrowthTips = (
  state: GrowthTipsState,
): readonly string[] => {
  const { members, weeklyConflicts, weeklyJoins } = state;

  const highConflict =
    weeklyConflicts > 0 && (members <= 0 || weeklyConflicts * 20 >= members);
  const rapidGrowth =
    weeklyJoins > 0 && members > 0 && weeklyJoins * 5 >= members;
  const lowGrowth =
    weeklyJoins === 0 || (members > 0 && weeklyJoins * 100 < members);
  const smallCommunity = members < SMALL_COMMUNITY_MEMBERS;

  const tips: string[] = [];
  if (highConflict) {
    tips.push(TIP_DRAMA);
  }
  if (rapidGrowth) {
    tips.push(TIP_RAPID);
  }
  if (lowGrowth) {
    tips.push(TIP_STAGNANT);
  }
  if (smallCommunity) {
    tips.push(TIP_SMALL);
  }

  for (const general of GENERAL_TIPS) {
    if (tips.length >= MIN_TIPS) {
      break;
    }
    if (!tips.includes(general)) {
      tips.push(general);
    }
  }

  return tips.slice(0, MAX_TIPS);
};

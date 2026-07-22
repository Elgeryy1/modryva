/**
 * State snapshot of a group used to mentor a brand-new owner.
 * `members` is the current member count, `hasRules` whether group rules are set,
 * `hasStaff` whether at least one moderator has been recruited.
 */
export interface OwnerMentorState {
  readonly members: number;
  readonly hasRules: boolean;
  readonly hasStaff: boolean;
}

/**
 * Below this member count a group is treated as small and gets a growth tip.
 * At or above it, a healthy group instead gets a maintenance tip.
 */
const OWNER_MENTOR_SMALL_GROUP = 10;

/**
 * Suggests 2 to 4 user-facing Spanish tips tailored to a new owner's group
 * state. A baseline welcome tip is always first; then a missing-rules tip,
 * a missing-staff tip, and either a growth tip (small group) or a maintenance
 * tip (established and healthy). The returned order is stable for a given
 * state. Pure and deterministic.
 */
export const suggestOwnerMentorTips = (
  state: OwnerMentorState,
): readonly string[] => {
  const tips: string[] = [
    "👋 Bienvenido como owner. Empieza poco a poco y sé constante con tu comunidad.",
  ];

  if (!state.hasRules) {
    tips.push(
      "📜 Aún no tienes reglas. Define normas claras para marcar el tono desde el principio.",
    );
  }

  if (!state.hasStaff) {
    tips.push(
      "🛡️ No tienes staff. Recluta moderadores de confianza para no llevar toda la carga tú solo.",
    );
  }

  if (state.members < OWNER_MENTOR_SMALL_GROUP) {
    tips.push(
      "🌱 Tu grupo es pequeño. Invita a personas afines y comparte contenido de valor para crecer.",
    );
  } else if (state.hasRules && state.hasStaff) {
    tips.push(
      "🎉 Tu comunidad está bien encaminada. Mantén la actividad con eventos y dinámicas regulares.",
    );
  }

  return tips;
};

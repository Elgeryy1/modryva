/** What a new member says they came for. Pure and deterministic. */
export type MemberGoal =
  | "aprender"
  | "socializar"
  | "vender"
  | "soporte"
  | "otro";

/**
 * The onboarding focus and tips tailored to a member's goal.
 * Pure and deterministic.
 */
export interface MemberGoalOnboarding {
  readonly focus: string;
  readonly tips: readonly string[];
}

const GOAL_ONBOARDING: Record<MemberGoal, MemberGoalOnboarding> = {
  aprender: {
    focus: "Aprender",
    tips: [
      "Revisa los recursos fijados",
      "Pregunta sin miedo en el tema correcto",
    ],
  },
  socializar: {
    focus: "Socializar",
    tips: ["Preséntate al grupo", "Únete a una conversación abierta"],
  },
  vender: {
    focus: "Vender",
    tips: [
      "Lee las normas de promoción",
      "Publica solo en el espacio permitido",
    ],
  },
  soporte: {
    focus: "Soporte",
    tips: [
      "Describe tu problema con detalle",
      "Indica versión y capturas si puedes",
    ],
  },
  otro: {
    focus: "General",
    tips: [
      "Lee las reglas del grupo",
      "Elige tus intereses para ver contenido útil",
    ],
  },
};

/**
 * Maps a new member's stated goal to a tailored onboarding focus and tips.
 * Unknown-style goals fall under "otro". Pure and deterministic.
 */
export const mapMemberGoalToOnboarding = (
  goal: MemberGoal,
): MemberGoalOnboarding => GOAL_ONBOARDING[goal];

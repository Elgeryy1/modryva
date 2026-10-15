/**
 * Possible de-escalation actions ordered by increasing intensity:
 * no action, suggest a pause, slow the room down, or full cool-down.
 * Pure and deterministic.
 */
export type DeescalationAction =
  | "ninguna"
  | "sugerir_pausa"
  | "ralentizar"
  | "enfriar";

/**
 * Signals used to decide a de-escalation action.
 * tension is a normalized 0..1 heat score; messagesPerMin is the current rate.
 * Pure and deterministic.
 */
export interface DeescalationInput {
  readonly tension: number;
  readonly messagesPerMin: number;
}

/**
 * Recommendation returned to the moderator: the chosen action plus a
 * user-facing Spanish message explaining it.
 * Pure and deterministic.
 */
export interface DeescalationAdvice {
  readonly action: DeescalationAction;
  readonly message: string;
}

const ADVICE_MESSAGES: Readonly<Record<DeescalationAction, string>> = {
  ninguna:
    "✅ La conversación fluye con normalidad. No se requiere ninguna acción.",
  sugerir_pausa:
    "🌿 El ambiente empieza a calentarse. ¿Qué tal una pausa breve para respirar?",
  ralentizar:
    "⏳ El ritmo es muy alto. Vamos a ralentizar y a responder con calma.",
  enfriar:
    "🧊 Activando modo desescalar: reduciremos la visibilidad de los mensajes más encendidos. Tomemos un respiro.",
};

/** Clamps a possibly non-finite number into [0, 1]. Pure and deterministic. */
const clampTension = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value >= 1 ? 1 : value;
};

/** Sanitizes a rate to a non-negative finite number. Pure and deterministic. */
const sanitizeRate = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
};

/** Selects the action given sanitized tension and rate. Pure and deterministic. */
const selectAction = (tension: number, rate: number): DeescalationAction => {
  if (tension >= 0.8 && rate >= 20) {
    return "enfriar";
  }
  if (tension >= 0.6 || rate >= 15) {
    return "ralentizar";
  }
  if (tension >= 0.35 || rate >= 8) {
    return "sugerir_pausa";
  }
  return "ninguna";
};

/**
 * Recommends a de-escalation action from conversation tension and message rate,
 * escalating from "ninguna" to "enfriar". Inputs are clamped and sanitized, so
 * negative, non-finite or out-of-range values are treated as neutral.
 * The returned message is user-facing Spanish. Pure and deterministic.
 */
export const recommendDeescalation = (
  input: DeescalationInput,
): DeescalationAdvice => {
  const tension = clampTension(input.tension);
  const rate = sanitizeRate(input.messagesPerMin);
  const action = selectAction(tension, rate);
  return { action, message: ADVICE_MESSAGES[action] };
};

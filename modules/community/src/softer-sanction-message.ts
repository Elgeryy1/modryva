/**
 * Input describing a moderation action and whether the calling context
 * intended it to be announced publicly.
 * Pure and deterministic.
 */
export interface SofterSanctionInput {
  /** Raw action name, e.g. "warn", "mute", "ban", "kick". Case-insensitive. */
  readonly action: string;
  /** Whether the caller originally wanted a public announcement. */
  readonly public: boolean;
}

/**
 * Result of softening a sanction: the recommended delivery channel plus a
 * neutral, non-humiliating user-facing Spanish message.
 * Pure and deterministic.
 */
export interface SofterSanctionMessage {
  /** Recommended channel: "privado" to avoid public drama, "publico" otherwise. */
  readonly channel: "privado" | "publico";
  /** Neutral message shown to the sanctioned user. */
  readonly message: string;
}

/**
 * Actions that are always delivered privately regardless of the public flag,
 * to avoid unnecessary public shaming for low-severity measures.
 */
const PRIVATE_FIRST_ACTIONS: readonly string[] = ["warn", "mute"];

/**
 * Neutral, low-drama messages keyed by normalized action name.
 * All strings are user-facing Spanish with correct accents.
 */
const SANCTION_MESSAGES: Readonly<Record<string, string>> = {
  warn: "Te dejamos un aviso discreto para cuidar la convivencia. Revisa las normas cuando puedas. 🙏",
  mute: "Aplicamos un silencio temporal. Te lo explicamos en privado para no exponerte. 🤫",
  ban: "Se ha retirado el acceso al grupo. Si crees que es un error, escríbenos y lo revisamos. 🤝",
  kick: "Te hemos quitado del grupo por ahora. Puedes volver cuando quieras respetando las normas. 🚪",
};

/**
 * Fallback message for unknown actions, kept neutral and private-friendly.
 */
const GENERIC_SANCTION_MESSAGE =
  "Hemos aplicado una medida de moderación con el menor ruido posible. Te damos los detalles en privado. 🤝";

/**
 * Softens a sanction so it causes as little public drama as possible.
 * Low-severity actions (warns, mutes) are always delivered privately; other
 * actions respect the requested public flag. The returned message is neutral
 * in tone and never shaming. Action matching is case-insensitive and trimmed.
 * Pure and deterministic.
 */
export const softenSanctionMessage = (
  input: SofterSanctionInput,
): SofterSanctionMessage => {
  const normalized = input.action.trim().toLowerCase();
  const channel: "privado" | "publico" = PRIVATE_FIRST_ACTIONS.includes(
    normalized,
  )
    ? "privado"
    : input.public
      ? "publico"
      : "privado";
  const message = SANCTION_MESSAGES[normalized] ?? GENERIC_SANCTION_MESSAGE;
  return { channel, message };
};

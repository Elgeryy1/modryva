/**
 * Size-aware configuration hints for Telegram groups. A community of 30 should
 * not be set up like one of 20.000, so this module maps a member count to a
 * tier and a short list of tips tailored to that scale.
 */

/**
 * Group-size tier, from the smallest (micro) to the largest (masivo).
 */
export type GroupSizeTier =
  | "micro"
  | "pequeno"
  | "mediano"
  | "grande"
  | "masivo";

/**
 * A tier plus the recommended configuration tips for a group of that size.
 */
export interface SizeRecommendation {
  readonly tier: GroupSizeTier;
  readonly recommendations: readonly string[];
}

// Exclusive upper bounds that separate the tiers, in ascending order.
const MICRO_MAX = 30;
const PEQUENO_MAX = 300;
const MEDIANO_MAX = 3000;
const GRANDE_MAX = 20000;

// User-facing Spanish tips per tier. Each list holds 2 to 4 items.
const RECOMMENDATIONS: Readonly<Record<GroupSizeTier, readonly string[]>> = {
  micro: [
    "Salúdalos a mano: con tan pocos miembros, el trato cercano funciona mejor. 👋",
    "Deja el antispam en modo suave: aquí el ruido es mínimo.",
    "Evita el CAPTCHA de entrada: añade fricción y no hace falta a esta escala.",
  ],
  pequeno: [
    "Activa un antispam básico y un filtro de enlaces para las primeras oleadas.",
    "Nombra a 1 o 2 moderadores de confianza para cubrir tu ausencia.",
    "Fija un mensaje con las reglas para que nadie tenga dudas. 📌",
  ],
  mediano: [
    "Activa el CAPTCHA de entrada: a esta escala ya llegan bots automáticos. 🤖",
    "Configura el antiflood y silencia los mensajes reenviados de otros canales.",
    "Reparte turnos de moderación para cubrir todas las franjas horarias.",
    "Registra las sanciones para mantener criterios coherentes.",
  ],
  grande: [
    "Endurece el antispam y exige verificación antes del primer mensaje. 🔒",
    "Crea un equipo de moderación con roles y un canal interno de avisos.",
    "Automatiza las sanciones por reincidencia y no dependas solo de la vigilancia manual.",
    "Revisa los informes de actividad cada semana para detectar picos extraños.",
  ],
  masivo: [
    "Aplica un antispam agresivo con verificación obligatoria y límite de ritmo. 🚨",
    "Monta un equipo grande de moderadores por turnos y zonas horarias.",
    "Usa la federación de baneos para frenar a los mismos abusadores en todos tus grupos.",
    "Divide la conversación en temas o subgrupos para que siga siendo manejable.",
  ],
};

/**
 * Normalizes a raw member count into a safe number: NaN and negative values
 * become 0, finite values are floored, and Infinity is preserved so extreme
 * inputs still land in the largest tier.
 * Pure and deterministic.
 */
const normalizeCount = (memberCount: number): number => {
  if (Number.isNaN(memberCount)) {
    return 0;
  }
  const nonNegative = memberCount < 0 ? 0 : memberCount;
  return Number.isFinite(nonNegative) ? Math.floor(nonNegative) : nonNegative;
};

/**
 * Classifies a group by its member count into a GroupSizeTier using exclusive
 * upper bounds (<30, <300, <3000, <20000, else). Negative or NaN counts are
 * treated as an empty group (micro).
 * Pure and deterministic.
 */
export const classifyGroupSize = (memberCount: number): GroupSizeTier => {
  const count = normalizeCount(memberCount);
  if (count < MICRO_MAX) {
    return "micro";
  }
  if (count < PEQUENO_MAX) {
    return "pequeno";
  }
  if (count < MEDIANO_MAX) {
    return "mediano";
  }
  if (count < GRANDE_MAX) {
    return "grande";
  }
  return "masivo";
};

/**
 * Returns the size tier for a member count together with the Spanish
 * configuration tips recommended at that scale. Always yields 2 to 4 tips.
 * Pure and deterministic.
 */
export const recommendBySize = (memberCount: number): SizeRecommendation => {
  const tier = classifyGroupSize(memberCount);
  return { tier, recommendations: RECOMMENDATIONS[tier] };
};

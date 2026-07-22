/**
 * Trust-tiers: permisos que se DESBLOQUEAN por comportamiento, no por pago
 * (nada de pay-to-unlock). Cuanto mas tiempo, mensajes, reputacion y gracias
 * acumula un miembro, mas alto sube su tier y mas permisos gana. Los warnings
 * activos degradan el tier como penalizacion. Logica pura y determinista: recibe
 * inputs planos por parametro y devuelve valores; sin I/O, sin red, sin reloj.
 */

/**
 * Tiers de confianza ordenados de menor a mayor privilegio. El indice en este
 * array es el "nivel" numerico del tier.
 */
export const TRUST_TIERS = ["nuevo", "activo", "veterano", "helper"] as const;

/** Union de los nombres de tier validos. */
export type TrustTier = (typeof TRUST_TIERS)[number];

/**
 * Estadisticas de comportamiento de un miembro. Todo son numeros planos que el
 * llamador calcula (edad en dias, contadores) para mantener este modulo puro.
 */
export interface TrustStats {
  /** Antiguedad del miembro en el grupo, en dias enteros. */
  readonly ageDays: number;
  /** Numero total de mensajes enviados. */
  readonly messages: number;
  /** Reputacion acumulada (puede ser negativa). */
  readonly reputation: number;
  /** Warnings de moderacion activos (sin expirar/perdonar). */
  readonly activeWarnings: number;
  /** Cuantas veces le han dado las gracias otros miembros. */
  readonly thanksReceived: number;
}

/** Permisos que un tier desbloquea. */
export interface TierUnlocks {
  /** Puede enviar enlaces sin que el filtro anti-links los borre. */
  readonly canSendLinks: boolean;
  /** Puede enviar media (fotos, videos, stickers) sin restriccion. */
  readonly canSendMedia: boolean;
  /** Puede usar el modo inline del bot. */
  readonly canUseInline: boolean;
}

/**
 * Requisito minimo para alcanzar cada tier "base" (antes de aplicar la
 * degradacion por warnings). Un miembro alcanza un tier si cumple TODOS los
 * umbrales de ese tier. El tier "nuevo" no tiene requisitos (es el suelo).
 */
interface TierRequirement {
  readonly minAgeDays: number;
  readonly minMessages: number;
  readonly minReputation: number;
  readonly minThanks: number;
}

const TIER_REQUIREMENTS: Readonly<Record<TrustTier, TierRequirement>> = {
  nuevo: { minAgeDays: 0, minMessages: 0, minReputation: 0, minThanks: 0 },
  activo: { minAgeDays: 3, minMessages: 20, minReputation: 0, minThanks: 0 },
  veterano: {
    minAgeDays: 30,
    minMessages: 200,
    minReputation: 10,
    minThanks: 3,
  },
  helper: {
    minAgeDays: 60,
    minMessages: 500,
    minReputation: 30,
    minThanks: 15,
  },
};

/**
 * Numero de warnings activos que baja un tier completo. Cada bloque de esta
 * cantidad de warnings degrada un escalon; asi un miembro con reputacion pero
 * con sanciones no conserva sus privilegios.
 */
export const TRUST_WARNINGS_PER_DEMOTION = 2;

const TIER_INDEX: Readonly<Record<TrustTier, number>> = {
  nuevo: 0,
  activo: 1,
  veterano: 2,
  helper: 3,
};

const meetsRequirement = (stats: TrustStats, req: TierRequirement): boolean =>
  stats.ageDays >= req.minAgeDays &&
  stats.messages >= req.minMessages &&
  // La reputacion solo es un umbral cuando el tier la exige (minReputation > 0).
  // Un tier sin requisito de reputacion (minReputation 0) no se bloquea por
  // reputacion negativa: sube por edad y mensajes igualmente.
  (req.minReputation <= 0 || stats.reputation >= req.minReputation) &&
  stats.thanksReceived >= req.minThanks;

/**
 * Calcula el tier de confianza de un miembro a partir de sus estadisticas.
 * Primero encuentra el tier base mas alto cuyos requisitos cumple (recorriendo
 * de mayor a menor), y despues lo degrada segun los warnings activos: cada
 * `TRUST_WARNINGS_PER_DEMOTION` warnings baja un escalon, sin caer nunca por
 * debajo de "nuevo". Puro y determinista.
 */
export const computeTrustTier = (stats: TrustStats): TrustTier => {
  let baseIndex = 0;
  for (let i = TRUST_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = TRUST_TIERS[i] as TrustTier;
    if (meetsRequirement(stats, TIER_REQUIREMENTS[tier])) {
      baseIndex = i;
      break;
    }
  }

  const demotion =
    stats.activeWarnings > 0
      ? Math.floor(stats.activeWarnings / TRUST_WARNINGS_PER_DEMOTION)
      : 0;

  const finalIndex = Math.max(0, baseIndex - demotion);
  return TRUST_TIERS[finalIndex] as TrustTier;
};

const UNLOCKS: Readonly<Record<TrustTier, TierUnlocks>> = {
  nuevo: { canSendLinks: false, canSendMedia: false, canUseInline: false },
  activo: { canSendLinks: false, canSendMedia: true, canUseInline: false },
  veterano: { canSendLinks: true, canSendMedia: true, canUseInline: false },
  helper: { canSendLinks: true, canSendMedia: true, canUseInline: true },
};

const isTrustTier = (tier: string): tier is TrustTier =>
  Object.hasOwn(TIER_INDEX, tier);

/**
 * Devuelve los permisos que desbloquea un tier. Un nombre desconocido se trata
 * como el suelo ("nuevo": todo bloqueado), asi el llamador nunca recibe
 * undefined. Puro y determinista.
 */
export const tierUnlocks = (tier: string): TierUnlocks =>
  isTrustTier(tier) ? UNLOCKS[tier] : UNLOCKS.nuevo;

const TIER_LABELS: Readonly<Record<TrustTier, string>> = {
  nuevo: "🌱 Nuevo",
  activo: "💬 Activo",
  veterano: "⭐ Veterano",
  helper: "🛡️ Helper",
};

/**
 * Formatea un tier como etiqueta legible con emoji para mostrar en el chat.
 * Un nombre desconocido devuelve un marcador generico en vez de romper. Puro y
 * determinista.
 */
export const formatTrustTier = (tier: string): string =>
  isTrustTier(tier) ? TIER_LABELS[tier] : "❔ Desconocido";

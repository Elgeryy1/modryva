/**
 * SLA de moderacion + escalado. Motor puro y determinista que decide si un
 * item de soporte/moderacion ha incumplido su objetivo de respuesta (SLA) y si
 * debe escalarse. No hace I/O ni usa Date.now(): recibe `nowMs`, el item y el
 * mapa de objetivos por severidad. Los strings user-facing van en espanol con
 * acentos; los comentarios/JSDoc son espanol-neutro sin acentos.
 */

/** Severidad de un item de moderacion. Ordena la urgencia del objetivo SLA. */
export type SlaSeverity = "baja" | "media" | "alta";

/**
 * Item de moderacion rastreado por el SLA. `openedMs` es el epoch (ms) en que
 * se abrio; `firstResponseMs` es el epoch (ms) de la primera respuesta del
 * equipo (opcional: si falta, aun no hubo respuesta).
 */
export interface SlaItem {
  readonly openedMs: number;
  readonly firstResponseMs?: number;
  readonly severity: SlaSeverity;
}

/** Resultado determinista de evaluar un item contra su objetivo SLA. */
export interface SlaEvaluation {
  readonly breached: boolean;
  readonly escalate: boolean;
  readonly reason: string;
}

/**
 * Objetivos SLA por defecto en milisegundos, por clave de severidad. La
 * severidad "alta" exige respuesta mas rapida. Congelado para que sea seguro
 * usarlo como fallback compartido.
 */
export const SLA_DEFAULT_TARGETS: Readonly<Record<string, number>> =
  Object.freeze({
    alta: 15 * 60_000,
    media: 60 * 60_000,
    baja: 4 * 60 * 60_000,
  });

/**
 * Multiplicador sobre el objetivo a partir del cual un item sin responder se
 * escala. Con 2 se escala cuando el tiempo de espera duplica el objetivo.
 */
export const SLA_ESCALATION_FACTOR = 2;

/** Devuelve el objetivo (ms) para una severidad, o null si no esta definido. */
const targetForSeverity = (
  severity: SlaSeverity,
  targets: Readonly<Record<string, number>>,
): number | null => {
  const value = targets[severity];
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
};

/**
 * Evalua un item de moderacion contra su objetivo SLA en el instante `nowMs`.
 *
 * Reglas deterministas:
 * - Si no hay objetivo definido/valido para la severidad: no incumple.
 * - Si ya hubo primera respuesta (`firstResponseMs`), se mide el tiempo de
 *   respuesta (firstResponseMs - openedMs) y solo `breached` puede ser true;
 *   nunca se escala un item ya atendido.
 * - Si no hubo respuesta, se mide la espera (nowMs - openedMs); incumple cuando
 *   supera el objetivo y escala cuando supera objetivo * SLA_ESCALATION_FACTOR.
 *
 * Puro: no lee reloj ni estado externo.
 */
export const evaluateSla = (
  item: SlaItem,
  nowMs: number,
  targets: Readonly<Record<string, number>>,
): SlaEvaluation => {
  const target = targetForSeverity(item.severity, targets);

  if (target === null) {
    return {
      breached: false,
      escalate: false,
      reason: `Sin objetivo SLA definido para severidad "${item.severity}".`,
    };
  }

  if (item.firstResponseMs !== undefined) {
    const responseMs = item.firstResponseMs - item.openedMs;
    if (responseMs > target) {
      return {
        breached: true,
        escalate: false,
        reason: `Respondido en ${responseMs}ms, superando el objetivo de ${target}ms.`,
      };
    }
    return {
      breached: false,
      escalate: false,
      reason: `Respondido en ${responseMs}ms dentro del objetivo de ${target}ms.`,
    };
  }

  const waitedMs = nowMs - item.openedMs;
  const escalateAt = target * SLA_ESCALATION_FACTOR;

  if (waitedMs > escalateAt) {
    return {
      breached: true,
      escalate: true,
      reason: `Sin respuesta tras ${waitedMs}ms, superando el umbral de escalado de ${escalateAt}ms.`,
    };
  }

  if (waitedMs > target) {
    return {
      breached: true,
      escalate: false,
      reason: `Sin respuesta tras ${waitedMs}ms, superando el objetivo de ${target}ms.`,
    };
  }

  return {
    breached: false,
    escalate: false,
    reason: `Sin respuesta tras ${waitedMs}ms, dentro del objetivo de ${target}ms.`,
  };
};

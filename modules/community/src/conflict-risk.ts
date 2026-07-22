/**
 * Prediccion heuristica de "hilo peligroso" (thread en riesgo de conflicto)
 * sin IA. A partir de estadisticas planas de un hilo — cuantos mensajes, cuanta
 * gente participa, cuantos borrados/ediciones y cada cuanto se escribe — estima
 * si la conversacion se esta calentando. La senal fuerte es una rafaga rapida de
 * mensajes, muchos borrados y pocos participantes concentrando la discusion.
 *
 * Modulo de logica pura: sin I/O, sin red, sin Date.now()/Math.random(). Todas
 * las entradas son numeros planos y la salida es determinista.
 */

/** Niveles de riesgo posibles para un hilo. */
export type ConflictLevel = "bajo" | "medio" | "alto";

/**
 * Estadisticas de un hilo/tema de un grupo, recolectadas por el llamador. Se
 * asume que son contadores no negativos; los valores invalidos (NaN, negativos)
 * se tratan como 0 para mantener el calculo robusto y determinista.
 */
export interface ThreadStats {
  /** Numero total de mensajes en la ventana observada. */
  readonly messages: number;
  /** Numero de participantes distintos que han escrito. */
  readonly participants: number;
  /** Numero de mensajes borrados en la ventana. */
  readonly deletions: number;
  /** Numero de participantes que han editado mensajes recientemente. */
  readonly recentEditsBy: number;
  /** Tiempo medio (ms) entre mensajes consecutivos. Menor = mas rafaga. */
  readonly avgGapMs: number;
}

/** Resultado del analisis de riesgo de un hilo. */
export interface ConflictRiskResult {
  /** Nivel discreto derivado del score. */
  readonly level: ConflictLevel;
  /** Puntuacion entera 0..100 (mayor = mas riesgo). */
  readonly score: number;
  /** Explicacion corta en espanol-neutro del factor dominante. */
  readonly reason: string;
}

/** Umbrales de score que delimitan cada nivel de riesgo. */
export const CONFLICT_RISK_THRESHOLDS = {
  medio: 30,
  alto: 60,
} as const;

/** Gap (ms) por debajo del cual la rafaga se considera maxima. */
const FAST_GAP_MS = 3_000;
/** Gap (ms) por encima del cual ya no hay senal de rafaga. */
const SLOW_GAP_MS = 60_000;
/** Ratio de borrados/mensajes que se considera saturacion total. */
const HEAVY_DELETION_RATIO = 0.3;
/** Mensajes por participante a partir de los cuales la discusion es intensa. */
const HIGH_MSGS_PER_PARTICIPANT = 8;
/** Mensajes por participante por debajo de los cuales no hay concentracion. */
const LOW_MSGS_PER_PARTICIPANT = 2;

/** Pesos de cada sub-senal en el score final (suman 1). */
const WEIGHTS = {
  burst: 0.35,
  deletion: 0.3,
  concentration: 0.2,
  edits: 0.15,
} as const;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value >= 1 ? 1 : value;
};

const nonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

/**
 * Sub-senal de rafaga (0..1) segun el gap medio entre mensajes: 1 cuando los
 * mensajes llegan casi seguidos (<= FAST_GAP_MS), 0 cuando estan espaciados
 * (>= SLOW_GAP_MS) e interpolacion lineal en medio. Un gap invalido/negativo se
 * trata como sin senal (0). Pura y determinista.
 */
export const conflictBurstScore = (avgGapMs: number): number => {
  if (!Number.isFinite(avgGapMs) || avgGapMs < 0) {
    return 0;
  }
  if (avgGapMs <= FAST_GAP_MS) {
    return 1;
  }
  if (avgGapMs >= SLOW_GAP_MS) {
    return 0;
  }
  return (SLOW_GAP_MS - avgGapMs) / (SLOW_GAP_MS - FAST_GAP_MS);
};

/**
 * Sub-senal de borrados (0..1): ratio borrados/mensajes escalado contra
 * HEAVY_DELETION_RATIO. Sin mensajes devuelve 0. Pura y determinista.
 */
export const conflictDeletionScore = (
  deletions: number,
  messages: number,
): number => {
  const total = nonNegative(messages);
  if (total <= 0) {
    return 0;
  }
  const ratio = nonNegative(deletions) / total;
  return clamp01(ratio / HEAVY_DELETION_RATIO);
};

/**
 * Sub-senal de concentracion (0..1): pocos participantes intercambiando muchos
 * mensajes. Requiere al menos 2 participantes (un monologo no es un conflicto);
 * escala los mensajes-por-participante entre LOW y HIGH. Pura y determinista.
 */
export const conflictConcentrationScore = (
  messages: number,
  participants: number,
): number => {
  const people = nonNegative(participants);
  const total = nonNegative(messages);
  if (people < 2 || total <= 0) {
    return 0;
  }
  const perParticipant = total / people;
  return clamp01(
    (perParticipant - LOW_MSGS_PER_PARTICIPANT) /
      (HIGH_MSGS_PER_PARTICIPANT - LOW_MSGS_PER_PARTICIPANT),
  );
};

/**
 * Sub-senal de ediciones (0..1): fraccion de participantes que han editado
 * mensajes recientemente. Sin participantes devuelve 0. Pura y determinista.
 */
export const conflictEditPressure = (
  recentEditsBy: number,
  participants: number,
): number => {
  const people = nonNegative(participants);
  if (people <= 0) {
    return 0;
  }
  return clamp01(nonNegative(recentEditsBy) / people);
};

const REASON_CALM = "Actividad tranquila, sin senales de conflicto.";
const REASON_BURST = "Rafaga rapida de mensajes en poco tiempo.";
const REASON_DELETION = "Volumen alto de mensajes borrados.";
const REASON_CONCENTRATION = "Pocos participantes concentrando la discusion.";
const REASON_EDITS = "Ediciones recientes frecuentes reescribiendo mensajes.";

/**
 * Calcula el riesgo de conflicto de un hilo combinando cuatro sub-senales
 * (rafaga, borrados, concentracion, ediciones) ponderadas en un score 0..100.
 * Un hilo con menos de 2 mensajes es siempre "bajo" (no hay conversacion que
 * analizar). El `reason` describe el factor dominante que empuja el score.
 * Pura y determinista: mismos inputs => mismo resultado.
 */
export const computeConflictRisk = (stats: ThreadStats): ConflictRiskResult => {
  const messages = nonNegative(stats.messages);

  if (messages < 2) {
    return { level: "bajo", score: 0, reason: REASON_CALM };
  }

  const burst = conflictBurstScore(stats.avgGapMs);
  const deletion = conflictDeletionScore(stats.deletions, messages);
  const concentration = conflictConcentrationScore(
    messages,
    stats.participants,
  );
  const edits = conflictEditPressure(stats.recentEditsBy, stats.participants);

  const weighted =
    burst * WEIGHTS.burst +
    deletion * WEIGHTS.deletion +
    concentration * WEIGHTS.concentration +
    edits * WEIGHTS.edits;

  const score = Math.round(clamp01(weighted) * 100);

  const level: ConflictLevel =
    score >= CONFLICT_RISK_THRESHOLDS.alto
      ? "alto"
      : score >= CONFLICT_RISK_THRESHOLDS.medio
        ? "medio"
        : "bajo";

  if (level === "bajo") {
    return { level, score, reason: REASON_CALM };
  }

  // Factor dominante = mayor contribucion ponderada. Empates se rompen en el
  // orden fijo burst > deletion > concentration > edits.
  const contributions: ReadonlyArray<readonly [number, string]> = [
    [burst * WEIGHTS.burst, REASON_BURST],
    [deletion * WEIGHTS.deletion, REASON_DELETION],
    [concentration * WEIGHTS.concentration, REASON_CONCENTRATION],
    [edits * WEIGHTS.edits, REASON_EDITS],
  ];

  const first = contributions[0] ?? ([0, REASON_CALM] as const);
  let bestValue = first[0];
  let bestReason = first[1];
  for (const entry of contributions) {
    if (entry[0] > bestValue) {
      bestValue = entry[0];
      bestReason = entry[1];
    }
  }

  return { level, score, reason: bestReason };
};

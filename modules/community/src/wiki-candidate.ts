/**
 * Detecta conversaciones que merecen guardarse como articulo de wiki/FAQ.
 * Un hilo vale la pena cuando es denso (varios mensajes), participan varias
 * personas, hay preguntas planteadas y, opcionalmente, enlaces de referencia.
 * Logica pura y determinista: recibe metricas planas ya agregadas por el
 * llamador (sin I/O, sin red, sin reloj). Modryto F4/Y.
 */

/**
 * Metricas agregadas de un hilo de conversacion candidato a wiki.
 * `durationMs` es el lapso entre el primer y el ultimo mensaje del hilo; el
 * llamador lo calcula para que este modulo no dependa del reloj.
 */
export interface ConversationStat {
  readonly messages: number;
  readonly participants: number;
  readonly questions: number;
  readonly links: number;
  readonly durationMs: number;
}

/** Resultado de puntuar un hilo como candidato a la wiki. */
export interface WikiCandidateResult {
  readonly worthSaving: boolean;
  /** Densidad del hilo, entero 0..100. */
  readonly score: number;
  /** Explicacion legible (con acentos) de la decision. */
  readonly reason: string;
}

/** Minimo de mensajes para que un hilo se considere guardable. */
export const WIKI_MIN_MESSAGES = 4;
/** Minimo de participantes distintos. */
export const WIKI_MIN_PARTICIPANTS = 2;
/** Minimo de preguntas planteadas en el hilo. */
export const WIKI_MIN_QUESTIONS = 1;
/** Umbral de densidad (score) para marcar worthSaving. */
export const WIKI_CANDIDATE_THRESHOLD = 55;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Aporte lineal saturado: `min(value, cap) / cap * weight`, con cap > 0. */
const contribution = (value: number, cap: number, weight: number): number =>
  (clamp(value, 0, cap) / cap) * weight;

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * Calcula la densidad de un hilo como entero 0..100 combinando mensajes,
 * participantes, preguntas, enlaces y duracion sostenida. No decide nada por
 * si sola: solo mide "cuanto contenido util" tiene el hilo. Pura.
 */
export const wikiCandidateScore = (stat: ConversationStat): number => {
  const messageScore = contribution(stat.messages, 20, 30);
  const participantScore = contribution(stat.participants, 5, 25);
  const questionScore = contribution(stat.questions, 4, 25);
  const linkScore = contribution(stat.links, 3, 10);
  const durationScore = contribution(stat.durationMs, THIRTY_MINUTES_MS, 10);

  const total =
    messageScore + participantScore + questionScore + linkScore + durationScore;

  return clamp(Math.round(total), 0, 100);
};

/**
 * Decide si un hilo merece guardarse en la wiki/FAQ y por que. Primero aplica
 * puertas duras (largo minimo, varios participantes, al menos una pregunta) y
 * luego exige densidad suficiente. Determinista: mismas metricas, mismo
 * resultado.
 */
export const scoreWikiCandidate = (
  stat: ConversationStat,
): WikiCandidateResult => {
  const score = wikiCandidateScore(stat);

  if (stat.messages < WIKI_MIN_MESSAGES) {
    return {
      worthSaving: false,
      score,
      reason: "Hilo demasiado corto para guardar en la wiki.",
    };
  }

  if (stat.participants < WIKI_MIN_PARTICIPANTS) {
    return {
      worthSaving: false,
      score,
      reason: "Solo participa una persona; no aporta a la wiki.",
    };
  }

  if (stat.questions < WIKI_MIN_QUESTIONS) {
    return {
      worthSaving: false,
      score,
      reason: "Sin preguntas planteadas; no parece material de FAQ.",
    };
  }

  if (score < WIKI_CANDIDATE_THRESHOLD) {
    return {
      worthSaving: false,
      score,
      reason: "Hilo poco denso; no vale la pena guardarlo aun.",
    };
  }

  return {
    worthSaving: true,
    score,
    reason: `Hilo denso: ${stat.messages} mensajes, ${stat.participants} participantes y ${stat.questions} preguntas. Vale para la wiki.`,
  };
};

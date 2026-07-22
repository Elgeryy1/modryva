/**
 * Nivel de enfado inferido a partir del texto de un cliente:
 * "ninguno" sin senales, "leve" con senales moderadas, "alto" con frustracion clara.
 * Pure and deterministic.
 */
export type AngerLevel = "ninguno" | "leve" | "alto";

/**
 * Resultado del analisis de enfado: nivel discreto, puntuacion numerica acumulada
 * y la lista ordenada de senales detectadas. Pure and deterministic.
 */
export interface AngerAssessment {
  readonly level: AngerLevel;
  readonly score: number;
  readonly hits: readonly string[];
}

/** Terminos de enfado en ASCII sin acentos; el texto se normaliza antes de comparar. */
const ANGER_TERMS: readonly string[] = [
  "horrible",
  "pesimo",
  "inutil",
  "estafa",
  "fraude",
  "verguenza",
  "indignante",
  "harto",
  "basura",
  "reembolso",
  "queja",
  "fatal",
  "peor",
  "terrible",
  "asco",
];

/** Etiqueta de senal para el griterio en mayusculas. */
const SHOUT_HIT = "mayusculas";

/** Etiqueta de senal para la puntuacion repetida (por ejemplo "!!!"). */
const PUNCT_HIT = "puntuacion";

/** Puntos que aporta cada termino de enfado detectado. */
const KEYWORD_WEIGHT = 2;

/** Puntos que aporta el griterio en mayusculas. */
const SHOUT_WEIGHT = 2;

/** Puntos que aporta la puntuacion repetida. */
const PUNCT_WEIGHT = 1;

/** Minimo de letras para considerar que un texto grita en mayusculas. */
const MIN_SHOUT_LETTERS = 4;

/** Proporcion minima de mayusculas para considerar que el texto grita. */
const SHOUT_RATIO = 0.7;

/** Puntuacion a partir de la cual el enfado se considera "alto". */
const HIGH_SCORE = 3;

/** Detecta una tirada de tres o mas signos "!" o "?" iguales seguidos. */
const REPEATED_PUNCT = /([!?])\1{2,}/;

/** Pasa a minusculas y elimina los acentos para poder comparar en ASCII. Pure and deterministic. */
const stripAccents = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Indica si el texto grita: tiene suficientes letras con una alta proporcion
 * de mayusculas. Pure and deterministic.
 */
const isShouting = (text: string): boolean => {
  let letters = 0;
  let uppers = 0;
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (lower !== upper) {
      letters += 1;
      if (ch === upper) {
        uppers += 1;
      }
    }
  }
  if (letters < MIN_SHOUT_LETTERS) {
    return false;
  }
  return uppers / letters >= SHOUT_RATIO;
};

/** Traduce una puntuacion numerica al nivel discreto de enfado. Pure and deterministic. */
const levelFromScore = (score: number): AngerLevel => {
  if (score <= 0) {
    return "ninguno";
  }
  if (score >= HIGH_SCORE) {
    return "alto";
  }
  return "leve";
};

/**
 * Analiza el texto de un cliente y estima su enfado combinando terminos de queja,
 * griterio en mayusculas y puntuacion repetida. Los aciertos se devuelven en un
 * orden fijo (terminos en el orden de ANGER_TERMS, luego mayusculas, luego
 * puntuacion) para poder priorizar de forma estable los mensajes mas frustrados.
 * Devuelve nivel "ninguno" para texto vacio o no definido. Pure and deterministic.
 */
export const detectAngerLevel = (text: string | undefined): AngerAssessment => {
  if (!text) {
    return { level: "ninguno", score: 0, hits: [] };
  }
  const normalized = stripAccents(text);
  const hits: string[] = [];
  let score = 0;
  for (const term of ANGER_TERMS) {
    if (normalized.includes(term) && !hits.includes(term)) {
      hits.push(term);
      score += KEYWORD_WEIGHT;
    }
  }
  if (isShouting(text)) {
    hits.push(SHOUT_HIT);
    score += SHOUT_WEIGHT;
  }
  if (REPEATED_PUNCT.test(text)) {
    hits.push(PUNCT_HIT);
    score += PUNCT_WEIGHT;
  }
  return { level: levelFromScore(score), score, hits };
};

/**
 * Atajo para priorizar la cola de soporte: indica si el mensaje refleja
 * frustracion alta (nivel "alto"). Pure and deterministic.
 */
export const isHighFrustration = (text: string | undefined): boolean =>
  detectAngerLevel(text).level === "alto";

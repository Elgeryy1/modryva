/**
 * Detector heuristico de provocacion pasivo-agresiva por frases (sin ML) para el
 * motor de moderacion del superbot. Recibe texto plano ya extraido por el gateway
 * y devuelve las frases marcadas mas un nivel ordinal segun cuantas coinciden.
 * Logica pura: no hace I/O, no toca red ni Prisma, no usa Date/Math.random; solo
 * recibe inputs planos y devuelve valores. Autocontenido, sin importar otros modulos.
 */

/**
 * Nivel de intensidad pasivo-agresiva derivado del numero de coincidencias:
 * "ninguno" sin coincidencias, "leve" con una, "alto" con dos o mas.
 */
export type PassiveAggressiveLevel = "ninguno" | "leve" | "alto";

/**
 * Resultado del analisis: si hubo coincidencia, las frases detectadas (en el orden
 * de PASSIVE_AGGRESSIVE_PHRASES, sin duplicados) y el nivel derivado.
 */
export interface PassiveAggressiveSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
  readonly level: PassiveAggressiveLevel;
}

/**
 * Frases pasivo-agresivas conocidas, normalizadas (minusculas, sin acentos). El
 * orden es estable y define el orden de salida de las coincidencias.
 */
export const PASSIVE_AGGRESSIVE_PHRASES = [
  "como digas",
  "si tu lo dices",
  "lo que tu digas",
  "obvio que no lo entiendes",
  "que gracioso",
  "tranquilo genio",
  "no me sorprende viniendo de ti",
  "no esperaba menos de ti",
  "que original",
] as const;

/** Quita tildes y diacriticos para comparar frases de forma robusta. */
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normaliza a minusculas sin acentos y con espacios colapsados. */
const normalize = (value: string): string =>
  stripAccents(value.toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Deriva el nivel ordinal a partir del numero de frases detectadas: 0 o menos
 * devuelve "ninguno", 1 devuelve "leve", 2 o mas devuelve "alto".
 * Pure and deterministic.
 */
const levelFor = (count: number): PassiveAggressiveLevel => {
  if (count <= 0) {
    return "ninguno";
  }
  if (count === 1) {
    return "leve";
  }
  return "alto";
};

/**
 * Detecta provocacion pasivo-agresiva por coincidencia de frases conocidas,
 * insensible a mayusculas y acentos. Devuelve las frases en el orden de
 * PASSIVE_AGGRESSIVE_PHRASES (no en el orden en que aparecen en el texto), sin
 * duplicados, y un nivel segun cuantas coinciden. Texto vacio, solo espacios o
 * undefined no marca nada. Pure and deterministic.
 */
export const detectPassiveAggressive = (
  text: string | undefined,
): PassiveAggressiveSignal => {
  if (!text) {
    return { matched: false, phrases: [], level: "ninguno" };
  }
  const haystack = normalize(text);
  if (!haystack) {
    return { matched: false, phrases: [], level: "ninguno" };
  }
  const phrases: string[] = [];
  for (const phrase of PASSIVE_AGGRESSIVE_PHRASES) {
    if (haystack.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return {
    matched: phrases.length > 0,
    phrases,
    level: levelFor(phrases.length),
  };
};

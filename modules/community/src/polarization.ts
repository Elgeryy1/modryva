/**
 * Medidor de polarizacion + deteccion de manipulacion social para grupos.
 * Logica pura y determinista: no hay I/O, red, Prisma ni relojes; recibe las
 * posturas ya recolectadas y el texto plano, y devuelve estructuras simples.
 *
 * Modelo: la comunidad se divide en dos bandos enfrentados ("a" y "b") mas los
 * indecisos ("neutral"). La polarizacion es alta cuando los dos bandos estan
 * equilibrados y ademas hay poca gente neutral.
 */

/** Postura de un participante: bando "a", bando "b" o sin definir. */
export type PolarizationStance = "a" | "b" | "neutral";

/** Nivel cualitativo de polarizacion de la conversacion. */
export type PolarizationLevel = "bajo" | "medio" | "alto";

/**
 * Resultado del medidor. `splitRatio` es un indice 0..1: 0 sin enfrentamiento
 * (un solo bando o todos neutrales), 1 cuando los dos bandos estan igualados y
 * nadie es neutral. Se redondea a 4 decimales para que sea determinista.
 */
export interface PolarizationResult {
  readonly level: PolarizationLevel;
  readonly splitRatio: number;
}

/** Resultado de la deteccion de manipulacion. `reason` solo si es manipulador. */
export interface ManipulationResult {
  readonly manipulative: boolean;
  readonly reason?: string;
}

/** Umbral de `splitRatio` a partir del cual la polarizacion es "alto". */
export const POLARIZATION_HIGH_THRESHOLD = 0.66;

/** Umbral de `splitRatio` a partir del cual la polarizacion es "medio". */
export const POLARIZATION_MID_THRESHOLD = 0.33;

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Calcula la polarizacion de una lista de posturas. Combina el equilibrio entre
 * los dos bandos (min/max) con la fraccion de gente que si toma partido, de modo
 * que un empate reñido con pocos neutrales puntua alto y una mayoria aplastante
 * o un mar de neutrales puntua bajo. Lista vacia o sin bandos => "bajo" con 0.
 * Pura y determinista.
 */
export const computePolarization = (
  stances: readonly PolarizationStance[],
): PolarizationResult => {
  const total = stances.length;
  let a = 0;
  let b = 0;
  for (const stance of stances) {
    if (stance === "a") {
      a += 1;
    } else if (stance === "b") {
      b += 1;
    }
  }

  const engaged = a + b;
  if (total === 0 || engaged === 0) {
    return { level: "bajo", splitRatio: 0 };
  }

  const balance = Math.min(a, b) / Math.max(a, b);
  const engagementFraction = engaged / total;
  const splitRatio = roundTo(balance * engagementFraction, 4);

  const level: PolarizationLevel =
    splitRatio >= POLARIZATION_HIGH_THRESHOLD
      ? "alto"
      : splitRatio >= POLARIZATION_MID_THRESHOLD
        ? "medio"
        : "bajo";

  return { level, splitRatio };
};

interface ManipulationPattern {
  readonly needle: string;
  readonly reason: string;
}

/**
 * Patrones de manipulacion social ordenados por prioridad. Los `needle` estan
 * ya normalizados (minusculas y sin acentos); los `reason` son texto
 * user-facing con acentuacion correcta.
 */
const MANIPULATION_PATTERNS: readonly ManipulationPattern[] = [
  {
    needle: "o estas con nosotros",
    reason: "Fuerza a tomar bando con un ultimátum de grupo.",
  },
  {
    needle: "si no estas con nosotros",
    reason: "Fuerza a tomar bando con un ultimátum de grupo.",
  },
  {
    needle: "o con nosotros o contra nosotros",
    reason: "Fuerza a tomar bando con un ultimátum de grupo.",
  },
  {
    needle: "el que no este de acuerdo",
    reason: "Descalifica a quien disiente para silenciarlo.",
  },
  {
    needle: "solo un tonto",
    reason: "Descalifica a quien disiente para silenciarlo.",
  },
  {
    needle: "solo un idiota",
    reason: "Descalifica a quien disiente para silenciarlo.",
  },
  {
    needle: "todos pensamos",
    reason: "Apela a un consenso inexistente para presionar.",
  },
  {
    needle: "todos sabemos",
    reason: "Apela a un consenso inexistente para presionar.",
  },
  {
    needle: "todos estamos de acuerdo",
    reason: "Apela a un consenso inexistente para presionar.",
  },
  {
    needle: "todo el mundo sabe",
    reason: "Apela a un consenso inexistente para presionar.",
  },
  {
    needle: "nadie puede negar",
    reason: "Apela a un consenso inexistente para presionar.",
  },
  {
    needle: "cualquiera sabe que",
    reason: "Presenta una opinión como obviedad indiscutible.",
  },
  {
    needle: "es obvio que",
    reason: "Presenta una opinión como obviedad indiscutible.",
  },
  {
    needle: "es evidente que",
    reason: "Presenta una opinión como obviedad indiscutible.",
  },
  {
    needle: "esta claro que",
    reason: "Presenta una opinión como obviedad indiscutible.",
  },
];

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detecta frases de manipulacion social: falso consenso ("todos pensamos"),
 * obviedad forzada ("cualquiera sabe que"), ultimatum de grupo ("o estas con
 * nosotros") y descalificacion del disidente. Ignora mayusculas y acentos al
 * comparar. Devuelve el primer patron que coincide, en orden de prioridad.
 * Pura y determinista.
 */
export const detectManipulation = (text: string): ManipulationResult => {
  const haystack = normalize(text);
  if (haystack.length === 0) {
    return { manipulative: false };
  }

  for (const pattern of MANIPULATION_PATTERNS) {
    if (haystack.includes(pattern.needle)) {
      return { manipulative: true, reason: pattern.reason };
    }
  }

  return { manipulative: false };
};

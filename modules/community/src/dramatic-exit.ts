/**
 * Detector de mensajes de "salida dramatica" del grupo: frases tipicas de
 * despedida teatral como "me voy del grupo", "adios a todos", "me largo",
 * "no vuelvo mas", "borrenme" o "hasta nunca". Logica pura y determinista:
 * no consulta reloj, no hace I/O y solo depende de su entrada de texto.
 */

/** Resultado del analisis: si hubo coincidencia y que frases canonicas la produjeron. */
export interface DramaticExitSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Frases canonicas (ya normalizadas: minusculas, sin acentos, espacios simples)
 * que delatan una salida dramatica. El orden es estable y define el orden de
 * los resultados devueltos por detectDramaticExit.
 */
export const DRAMATIC_EXIT_PHRASES: readonly string[] = [
  "me voy del grupo",
  "adios a todos",
  "me largo",
  "no vuelvo mas",
  "borrenme",
  "hasta nunca",
];

/** Quita marcas diacriticas (acentos, tildes) descomponiendo en NFD. */
const stripDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Normaliza texto para comparar: minusculas, sin diacriticos, con runs de
 * espacios en blanco colapsados a un solo espacio y recortado en los bordes.
 */
const normalize = (value: string): string =>
  stripDiacritics(value.toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Detecta frases de salida dramatica en un mensaje, sin distinguir mayusculas
 * ni acentos y tolerando espacios extra. Devuelve las frases canonicas
 * coincidentes deduplicadas y en el orden de DRAMATIC_EXIT_PHRASES. Texto
 * vacio, indefinido o solo espacios produce un resultado sin coincidencias.
 * Pure and deterministic.
 */
export const detectDramaticExit = (
  text: string | undefined,
): DramaticExitSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }

  const haystack = normalize(text);
  if (!haystack) {
    return { matched: false, phrases: [] };
  }

  const phrases: string[] = [];
  for (const phrase of DRAMATIC_EXIT_PHRASES) {
    if (haystack.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }

  return { matched: phrases.length > 0, phrases };
};

/**
 * Detector de DM bait: mensajes que empujan a la victima hacia el chat privado
 * ("mandame DM", "escribeme por privado", "te escribo al privado") usados a
 * menudo para scam fuera de la vista de los moderadores. Inspecciona solo el
 * texto del mensaje y emite una senal con las frases detectadas. Puro y
 * determinista: sin I/O, red ni relojes.
 */

/**
 * Senal emitida por el detector. `matched` indica si hubo al menos una
 * coincidencia y `phrases` lista las frases halladas, sin duplicados y en el
 * orden de DM_BAIT_PHRASES (no en el orden en que aparecen en el texto).
 */
export interface DmBaitSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Frases-gancho de DM bait, en minusculas y sin acentos porque el texto se
 * normaliza antes de comparar. El orden define la prioridad de salida en
 * `phrases`. Ninguna frase es subcadena de otra para que cada coincidencia sea
 * independiente. Pure and deterministic.
 */
export const DM_BAIT_PHRASES: readonly string[] = [
  "mandame dm",
  "escribeme por privado",
  "te escribo al privado",
  "hablame por dm",
  "contactame en privado",
];

/**
 * Normaliza el texto para comparar: minusculas, quita diacriticos (acentos) y
 * colapsa cualquier espacio en blanco a un unico espacio. Deja el texto listo
 * para buscar frases planas sin acentos. Pure and deterministic.
 */
const normalizeDmBaitText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detecta DM bait en el texto. Devuelve las frases de DM_BAIT_PHRASES
 * presentes, sin duplicados y en el orden de esa lista (independiente del orden
 * en que aparecen en el texto). La comparacion ignora mayusculas y acentos.
 * Para texto vacio, solo espacios o undefined devuelve una senal sin
 * coincidencias. Pure and deterministic.
 */
export const detectDmBait = (text: string | undefined): DmBaitSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const normalized = normalizeDmBaitText(text);
  if (normalized.length === 0) {
    return { matched: false, phrases: [] };
  }
  const phrases: string[] = [];
  for (const phrase of DM_BAIT_PHRASES) {
    if (normalized.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return { matched: phrases.length > 0, phrases };
};

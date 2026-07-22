/**
 * Detector de invitaciones encubiertas: spam que empuja a la victima fuera del
 * grupo hacia un perfil, una bio o un chat privado sin pegar el enlace directo
 * ("entra al canal de mi perfil", "mira mi bio", "escribeme", "link en mi bio",
 * "revisa mi perfil"). Inspecciona solo el texto del mensaje y emite una senal
 * con las frases detectadas. Puro y determinista: sin I/O, red ni relojes.
 */

/**
 * Senal emitida por el detector. `matched` indica si hubo al menos una
 * coincidencia y `phrases` lista las frases halladas, sin duplicados y en el
 * orden de COVERT_INVITE_PHRASES (no en el orden en que aparecen en el texto).
 */
export interface CovertInviteSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Frases-gancho curadas, en minusculas y sin acentos porque el texto se
 * normaliza antes de comparar. El orden define la prioridad de salida en
 * `phrases`. Ninguna frase es subcadena de otra para que cada coincidencia sea
 * independiente. Pure and deterministic.
 */
export const COVERT_INVITE_PHRASES: readonly string[] = [
  "canal de mi perfil",
  "canal en mi perfil",
  "link en mi bio",
  "enlace en mi bio",
  "mira mi bio",
  "revisa mi bio",
  "revisa mi perfil",
  "mira mi perfil",
  "escribeme",
  "hablame por privado",
];

/**
 * Normaliza el texto para comparar: minusculas, quita diacriticos (acentos) y
 * colapsa cualquier espacio en blanco a un unico espacio. Deja el texto listo
 * para buscar frases planas sin acentos.
 */
const normalizeInviteText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detecta invitaciones encubiertas en el texto. Devuelve las frases de
 * COVERT_INVITE_PHRASES presentes, sin duplicados y en el orden de esa lista
 * (independiente del orden en que aparecen en el texto). Para texto vacio,
 * solo espacios o undefined devuelve una senal sin coincidencias.
 * Pure and deterministic.
 */
export const detectCovertInvite = (
  text: string | undefined,
): CovertInviteSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const normalized = normalizeInviteText(text);
  if (normalized.length === 0) {
    return { matched: false, phrases: [] };
  }
  const phrases: string[] = [];
  for (const phrase of COVERT_INVITE_PHRASES) {
    if (normalized.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return { matched: phrases.length > 0, phrases };
};

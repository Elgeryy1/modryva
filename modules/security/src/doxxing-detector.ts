import { detectPii } from "./pii-redaction.js";

/**
 * Result of scanning a message for doxxing markers. `matched` is true when at
 * least one marker kind was found; `kinds` lists the detected kinds in the
 * curated KIND order, without duplicates.
 * Pure and deterministic.
 */
export interface DoxxingSignal {
  readonly matched: boolean;
  readonly kinds: readonly string[];
}

/**
 * Matches a Spanish DNI: exactly 8 digits followed by one letter, bounded by
 * word boundaries so it does not fire inside longer digit runs.
 * Pure and deterministic.
 */
const DNI_PATTERN = /\b\d{8}[a-zA-Z]\b/;

/**
 * Matches a Spanish plate: 4 digits, an optional single space, then 3 letters.
 *
 * Las tres letras deben ser CONSONANTES: la DGT excluye las vocales de las
 * matriculas precisamente para no formar palabras. Sin esa restriccion el
 * patron marcaba fechas normales como "2026 jul" o "1999 abr" y el bot las
 * borraba como si fueran datos personales.
 * Pure and deterministic.
 */
const PLATE_PATTERN = /\b\d{4}\s?[BCDFGHJKLMNPRSTVWXYZ]{3}\b/i;

/**
 * Matches a street reference (calle / avenida / avda / c/) followed by a
 * number that CIERRA la frase: final de texto, puntuacion, o un token de piso
 * ("bajo", "3o", "izq"...).
 *
 * Ese anclaje es lo que separa "vivo en Calle Mayor 5" (una direccion de
 * verdad) de "en la calle habia como 20 personas" (una frase inocente que el
 * patron anterior borraba, porque solo pedia un numero en algun sitio de la
 * linea).
 * Pure and deterministic.
 */
const ADDRESS_PATTERN =
  /(?:\bcalle\b|\bavenida\b|\bavda\b|c\/)[^\n,;]{0,30}?\b\d{1,4}\b(?=\s*(?:[,.;:!?)]|$|\b(?:bajo|piso|puerta|pta|izq|izquierda|dcha|derecha|esc|escalera)\b|[oaºª]\b))/i;

/**
 * Un numero es telefono si viene FORMATEADO (separadores o prefijo
 * internacional) o si tiene exactamente 9 digitos, que es la longitud de un
 * numero nacional espanol.
 *
 * Una tirada larga de digitos sin formato NO es un telefono: es un id de
 * Telegram (10 digitos), una puntuacion, un numero de visitas. Aceptarlas era
 * la causa de la mayoria de los borrados injustos.
 * Pure and deterministic.
 */
const looksLikePhone = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) {
    return true;
  }
  const formatted = /[\s().-]/.test(raw.trim()) || raw.trim().startsWith("+");
  return formatted && digits.length >= 9 && digits.length <= 15;
};

/**
 * Detects doxxing markers in a message: telefonos, correos, IBAN, URLs con
 * credenciales, DNI, matriculas y direcciones postales.
 *
 * Los datos de contacto (telefono, email, IBAN, credenciales) los extrae
 * `detectPii`, que ya sabe leerlos con separadores; aqui se anaden los
 * marcadores espanoles que aquel no cubre y se filtra el ruido.
 *
 * Returns the matched kinds deduplicated and in the curated order. Empty
 * result for undefined or clean text. Pure and deterministic.
 */
export const detectDoxxing = (text: string | undefined): DoxxingSignal => {
  if (!text) {
    return { matched: false, kinds: [] };
  }

  const pii = detectPii(text);
  const kinds: string[] = [];

  if (pii.phones.some(looksLikePhone)) {
    kinds.push("telefono");
  }
  if (pii.emails.length > 0) {
    kinds.push("email");
  }
  if (pii.ibans.length > 0) {
    kinds.push("iban");
  }
  if (pii.urlsWithCreds.length > 0) {
    kinds.push("credenciales");
  }
  if (DNI_PATTERN.test(text)) {
    kinds.push("dni");
  }
  if (PLATE_PATTERN.test(text)) {
    kinds.push("matricula");
  }
  if (ADDRESS_PATTERN.test(text)) {
    kinds.push("direccion");
  }

  return { matched: kinds.length > 0, kinds };
};

/**
 * Clasificador heuristico de logs (idea #338) SIN IA real: etiqueta una linea de
 * log por palabras clave para poder filtrar/agrupar. Funciona sin claves de
 * proveedor (fallback determinista de la capa de IA aplicada). Logica pura: sin
 * I/O, sin reloj, sin azar.
 */

/** Etiquetas de log soportadas, en orden estable de salida. */
export const LOG_TAGS = [
  "spam",
  "permisos",
  "staff",
  "casino",
  "bugs",
  "moderacion",
] as const;

/** Una etiqueta de log valida. */
export type LogTag = (typeof LOG_TAGS)[number];

/** Palabras clave (normalizadas) que disparan cada etiqueta. */
const TAG_KEYWORDS: Readonly<Record<LogTag, readonly string[]>> = {
  spam: ["spam", "flood", "enlace", "link", "estafa", "scam", "publicidad"],
  permisos: ["permiso", "admin", "promov", "degrad", "rol", "acceso"],
  staff: ["staff", "moderador", "turno", "guardia", "revision"],
  casino: ["casino", "apuesta", "fichas", "ruleta", "blackjack", "jackpot"],
  bugs: ["error", "excepcion", "fallo", "bug", "crash", "timeout"],
  moderacion: ["ban", "mute", "warn", "kick", "sancion", "expuls", "captcha"],
};

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Devuelve las etiquetas que aplican a una linea de log, en el orden fijo de
 * `LOG_TAGS`, sin duplicados. Una etiqueta aplica si alguna de sus palabras
 * clave aparece en el texto normalizado. Pura y determinista.
 */
export const tagLog = (text: string): readonly LogTag[] => {
  const haystack = normalize(text);
  const tags: LogTag[] = [];
  for (const tag of LOG_TAGS) {
    const keywords = TAG_KEYWORDS[tag];
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      tags.push(tag);
    }
  }
  return tags;
};

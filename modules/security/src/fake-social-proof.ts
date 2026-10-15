/**
 * Detector de prueba social falsa para el motor de seguridad del superbot.
 * Analiza un texto plano y marca frases tipicas de estafa que fingen exito de
 * otros usuarios ("ya gane dinero", "100% real", "pago real", "me funciono",
 * "retire sin problemas", "es legit"). Logica pura y determinista: no hace I/O,
 * no toca red ni Prisma y no usa Date ni Math.random; solo recibe un string y
 * devuelve un valor plano. No importa tipos de Telegram ni de dominio.
 */

/**
 * Resultado del detector. `matched` es true si se encontro al menos una frase;
 * `phrases` lista las frases catalogadas detectadas, sin duplicados y en el
 * orden de FAKE_SOCIAL_PROOF_PHRASES (no en el orden en que aparecen en el texto).
 */
export interface FakeSocialProofSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Catalogo de frases de prueba social falsa, ya normalizadas (minusculas y sin
 * acentos). Son tokens internos de comparacion, no texto mostrado al usuario.
 * El orden es estable y define el orden de salida del detector.
 */
export const FAKE_SOCIAL_PROOF_PHRASES = [
  "ya gane dinero",
  "100% real",
  "pago real",
  "me funciono",
  "retire sin problemas",
  "es legit",
  "no es estafa",
  "pago seguro",
  "me pagaron",
  "totalmente real",
  "funciona de verdad",
  "retiro sin problemas",
] as const;

/** Quita tildes y diacriticos para comparar frases de forma robusta. */
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normaliza a minusculas sin acentos y con espacios colapsados. */
const normalize = (value: string): string =>
  stripAccents(value.toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Detecta frases de prueba social falsa en un texto, sin distinguir mayusculas
 * ni acentos, deduplicadas y preservando el orden de FAKE_SOCIAL_PROOF_PHRASES.
 * Devuelve un resultado vacio para texto ausente o limpio. Los tokens devueltos
 * estan normalizados (minusculas, sin acentos) y no reflejan el texto original.
 * Pure and deterministic.
 */
export const detectFakeSocialProof = (
  text: string | undefined,
): FakeSocialProofSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const normalized = normalize(text);
  const phrases: string[] = [];
  for (const phrase of FAKE_SOCIAL_PROOF_PHRASES) {
    if (normalized.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return { matched: phrases.length > 0, phrases };
};

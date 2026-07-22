/**
 * Sensitive-announcement detector for admin broadcasts. Flags text that could
 * spark controversy inside a Telegram community (politics, religion, price
 * hikes, closures, layoffs, drastic changes) so an admin can double-check
 * before publishing. Pure and deterministic.
 */

/**
 * Controversy category an announcement can fall into. Values are stable ASCII
 * slugs used as keys and in output. Pure and deterministic.
 */
export type SensitiveTopic =
  | "politica"
  | "religion"
  | "precios"
  | "cierre"
  | "despido"
  | "cambios";

/**
 * Result of scanning an announcement: whether it is sensitive and which topics
 * were detected. Topics are always returned in SensitiveTopic declaration
 * order and never duplicated. Pure and deterministic.
 */
export interface SensitiveAnnouncement {
  readonly sensitive: boolean;
  readonly topics: readonly SensitiveTopic[];
}

interface TopicRule {
  readonly topic: SensitiveTopic;
  readonly terms: readonly string[];
}

// Terms are PLAIN ASCII (no accents, no tildes) and lowercase; inbound text is
// normalized to ASCII lowercase before matching, so accented Spanish such as
// "politica" or "religion" still matches these entries. Keep terms to
// [a-z ] only so they are safe to embed in a RegExp without escaping.
const TOPIC_RULES: readonly TopicRule[] = [
  {
    topic: "politica",
    terms: [
      "politica",
      "politico",
      "politicos",
      "politicas",
      "gobierno",
      "elecciones",
      "partido",
      "presidente",
    ],
  },
  {
    topic: "religion",
    terms: [
      "religion",
      "religioso",
      "religiosa",
      "iglesia",
      "dios",
      "biblia",
      "coran",
      "musulman",
      "cristiano",
      "catolico",
    ],
  },
  {
    topic: "precios",
    terms: [
      "subida de precios",
      "subida de precio",
      "subir precios",
      "aumento de precios",
      "aumento de precio",
      "incremento de precios",
      "suben los precios",
      "mas caro",
      "mas caros",
    ],
  },
  {
    topic: "cierre",
    terms: ["cierre", "cerramos", "cerraremos", "clausura", "cerrar el grupo"],
  },
  {
    topic: "despido",
    terms: [
      "despido",
      "despidos",
      "despedir",
      "despedimos",
      "recorte de personal",
      "recortes de personal",
    ],
  },
  {
    topic: "cambios",
    terms: [
      "cambios drasticos",
      "cambio drastico",
      "cambio radical",
      "cambios radicales",
      "cambios importantes",
    ],
  },
];

interface CompiledRule {
  readonly topic: SensitiveTopic;
  readonly patterns: readonly RegExp[];
}

// Precompiled word-boundary matchers, one per term. Word boundaries avoid
// false positives such as "dios" matching inside "estudios".
const COMPILED_RULES: readonly CompiledRule[] = TOPIC_RULES.map((rule) => ({
  topic: rule.topic,
  patterns: rule.terms.map((term) => new RegExp(`\\b${term}\\b`)),
}));

const TOPIC_LABELS: Record<SensitiveTopic, string> = {
  politica: "política",
  religion: "religión",
  precios: "precios",
  cierre: "cierre",
  despido: "despidos",
  cambios: "cambios drásticos",
};

// Strip diacritics (accents, tildes) and lowercase so matching is accent- and
// case-insensitive. NFD splits letters like "n-tilde" or accented vowels into a
// base ASCII letter plus a combining mark, which the regex then removes.
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Scans an announcement for controversial topics. Returns not-sensitive with an
 * empty topic list for undefined or empty input. Detected topics come back in
 * SensitiveTopic declaration order, deduplicated, regardless of where they
 * appear in the text. Pure and deterministic.
 */
export const detectSensitiveAnnouncement = (
  text: string | undefined,
): SensitiveAnnouncement => {
  if (!text) {
    return { sensitive: false, topics: [] };
  }
  const normalized = normalize(text);
  const topics: SensitiveTopic[] = [];
  for (const rule of COMPILED_RULES) {
    const matched = rule.patterns.some((pattern) => pattern.test(normalized));
    if (matched) {
      topics.push(rule.topic);
    }
  }
  return { sensitive: topics.length > 0, topics };
};

/**
 * Builds a Spanish admin-facing warning describing the detected topics, or
 * undefined when the announcement is not sensitive. Pure and deterministic.
 */
export const describeSensitiveWarning = (
  result: SensitiveAnnouncement,
): string | undefined => {
  if (!result.sensitive) {
    return undefined;
  }
  const labels = result.topics.map((topic) => TOPIC_LABELS[topic]);
  return `⚠️ Este anuncio puede generar polémica: ${labels.join(", ")}. ¿Seguro que quieres publicarlo?`;
};

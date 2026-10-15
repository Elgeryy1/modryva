/**
 * Classification label for a remorse "traffic light".
 * "acepta" = accepts the rule, "niega" = denies the facts,
 * "hostil" = insults the staff, "neutro" = no signal found.
 * These are neutral behavioral signals, not moral judgements.
 */
export type RemorseLevel = "acepta" | "niega" | "hostil" | "neutro";

/**
 * Result of scanning a message for remorse signals: the winning
 * signal and the ordered, deduplicated keywords that justify it.
 */
export interface RemorseSignal {
  readonly signal: RemorseLevel;
  readonly hits: readonly string[];
}

/**
 * Keywords indicating the user accepts the rule / apologizes.
 * Stored diacritic-free so normalized input matches accented variants.
 */
const ACCEPT_TERMS: readonly string[] = [
  "perdon",
  "lo siento",
  "disculpa",
  "tienes razon",
  "me equivoque",
  "mi culpa",
  "acepto",
  "no volvera a pasar",
];

/**
 * Keywords indicating the user denies the facts. Diacritic-free.
 */
const DENIAL_TERMS: readonly string[] = [
  "no fui yo",
  "yo no fui",
  "no hice nada",
  "es mentira",
  "es falso",
  "no es verdad",
];

/**
 * Keywords indicating the user insults the staff / is hostile. Diacritic-free.
 */
const HOSTILE_TERMS: readonly string[] = [
  "idiota",
  "estupido",
  "imbecil",
  "payaso",
  "inutil",
  "callate",
  "basura",
];

/**
 * Lowercases text and strips diacritics (NFD + combining-mark removal)
 * so that accented input like "Perdon" vs "Perdón" both match ASCII terms.
 * Pure and deterministic.
 */
const normalizeText = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Collects the terms present in the normalized text, preserving the term
 * list order and skipping duplicates. Pure and deterministic.
 */
const collectHits = (
  normalized: string,
  terms: readonly string[],
): string[] => {
  const hits: string[] = [];
  for (const term of terms) {
    if (normalized.includes(term) && !hits.includes(term)) {
      hits.push(term);
    }
  }
  return hits;
};

/**
 * Classifies a message into a remorse signal. Hostility wins over denial,
 * denial wins over acceptance when several categories match; hits contain
 * only the matched keywords of the winning category, in category order.
 * Returns "neutro" with no hits for undefined, empty or clean text.
 * These are behavioral signals, not a moral verdict.
 * Pure and deterministic.
 */
export const classifyRemorse = (text: string | undefined): RemorseSignal => {
  if (!text) {
    return { signal: "neutro", hits: [] };
  }
  const normalized = normalizeText(text);
  const hostile = collectHits(normalized, HOSTILE_TERMS);
  if (hostile.length > 0) {
    return { signal: "hostil", hits: hostile };
  }
  const denial = collectHits(normalized, DENIAL_TERMS);
  if (denial.length > 0) {
    return { signal: "niega", hits: denial };
  }
  const accept = collectHits(normalized, ACCEPT_TERMS);
  if (accept.length > 0) {
    return { signal: "acepta", hits: accept };
  }
  return { signal: "neutro", hits: [] };
};

/**
 * Appeal classification for moderation sanctions. Given the free text a
 * sanctioned user writes when appealing, it detects the dominant intent:
 * a claimed mistake, genuine remorse, hostile abuse, or plain confusion.
 * Matching is accent-insensitive and case-insensitive so real Spanish
 * input classifies the same regardless of typing style.
 */

/**
 * Possible outcomes of an appeal classification. "sin_clasificar" means no
 * known signal was found. Pure and deterministic.
 */
export type AppealCategory =
  | "error"
  | "arrepentimiento"
  | "abuso"
  | "confusion"
  | "sin_clasificar";

/**
 * Result of classifying an appeal: the winning category plus the ASCII
 * keyword tokens that triggered it, in keyword-set order and deduplicated.
 * Pure and deterministic.
 */
export interface AppealCategoryResult {
  readonly category: AppealCategory;
  readonly hits: readonly string[];
}

interface CategoryRule {
  readonly category: AppealCategory;
  readonly keywords: readonly string[];
}

/**
 * Category rules in priority order. When an appeal matches several
 * categories, the earliest rule here wins. Hostile abuse is surfaced first so
 * it can be handled before benign intents; then a claimed error, then
 * remorse, then confusion. Keywords are plain ASCII (no accents) because the
 * input is normalized before matching.
 */
const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "abuso",
    keywords: [
      "idiota",
      "estupido",
      "imbecil",
      "basura",
      "inutil",
      "callate",
      "mierda",
      "payaso",
    ],
  },
  {
    category: "error",
    keywords: [
      "error",
      "equivocacion",
      "injusto",
      "injusta",
      "sin razon",
      "no hice nada",
      "no fui yo",
      "me confundieron",
      "falso positivo",
    ],
  },
  {
    category: "arrepentimiento",
    keywords: [
      "perdon",
      "lo siento",
      "disculpa",
      "me arrepiento",
      "no volvera a pasar",
      "prometo",
      "mi culpa",
    ],
  },
  {
    category: "confusion",
    keywords: [
      "no entiendo",
      "por que",
      "confundido",
      "confusion",
      "que paso",
      "no comprendo",
      "no me queda claro",
    ],
  },
];

/**
 * Lowercases text and strips diacritics so accented Spanish input matches the
 * plain-ASCII keyword sets. Pure and deterministic.
 */
const normalizeText = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Classifies an appeal message into a single category by scanning normalized
 * text against ordered keyword sets and returning the first category that has
 * at least one hit. Returns "sin_clasificar" with no hits for undefined,
 * empty, or unrecognized text. Pure and deterministic.
 */
export const categorizeAppeal = (
  text: string | undefined,
): AppealCategoryResult => {
  if (!text) {
    return { category: "sin_clasificar", hits: [] };
  }
  const normalized = normalizeText(text);
  for (const rule of CATEGORY_RULES) {
    const hits: string[] = [];
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword) && !hits.includes(keyword)) {
        hits.push(keyword);
      }
    }
    if (hits.length > 0) {
      return { category: rule.category, hits };
    }
  }
  return { category: "sin_clasificar", hits: [] };
};

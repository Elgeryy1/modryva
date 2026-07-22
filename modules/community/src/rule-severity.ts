/**
 * Severity level assigned to a group rule, ordered conceptually from the
 * lightest ("leve") to the most severe ("expulsion").
 * Pure and deterministic.
 */
export type RuleSeverityLevel = "leve" | "media" | "grave" | "expulsion";

/**
 * Classification of a rule severity: a numeric rank (1..4), a recommended
 * moderation action written in Spanish and a colour emoji used to flag it.
 * Pure and deterministic.
 */
export interface RuleSeverity {
  /** Numeric weight of the severity, 1 (leve) .. 4 (expulsion). */
  readonly rank: number;
  /** User-facing Spanish text describing the recommended moderation action. */
  readonly recommendedAction: string;
  /** Colour emoji used to flag the severity inside messages. */
  readonly emoji: string;
}

/**
 * All known severity levels ordered by ascending rank. Useful for rendering
 * menus or iterating deterministically over every level.
 * Pure and deterministic.
 */
export const RULE_SEVERITY_LEVELS: readonly RuleSeverityLevel[] = [
  "leve",
  "media",
  "grave",
  "expulsion",
];

const SEVERITY_TABLE: Readonly<Record<RuleSeverityLevel, RuleSeverity>> = {
  leve: {
    rank: 1,
    recommendedAction:
      "Aviso amistoso: recuérdale la norma al usuario sin aplicar sanción. 🟢",
    emoji: "🟢",
  },
  media: {
    rank: 2,
    recommendedAction:
      "Advertencia formal: registra el aviso y aplica silencio temporal si reincide.",
    emoji: "🟡",
  },
  grave: {
    rank: 3,
    recommendedAction:
      "Sanción firme: silencio prolongado y revisión por el equipo de moderación.",
    emoji: "🟠",
  },
  expulsion: {
    rank: 4,
    recommendedAction:
      "¡Expulsión inmediata del grupo con baneo permanente del usuario!",
    emoji: "🔴",
  },
};

/**
 * Classifies a rule severity level into its rank, recommended action and
 * emoji. Always returns a defined RuleSeverity for the four known levels.
 * Pure and deterministic.
 */
export const classifyRuleSeverity = (level: RuleSeverityLevel): RuleSeverity =>
  SEVERITY_TABLE[level];

/**
 * Parses free-form text into a known RuleSeverityLevel. Case-insensitive,
 * trims surrounding whitespace and ignores accents, so "  Expulsión " maps to
 * "expulsion". Returns undefined for empty, blank or unknown input.
 * Pure and deterministic.
 */
export const parseRuleSeverity = (
  value: string | undefined,
): RuleSeverityLevel | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const level of RULE_SEVERITY_LEVELS) {
    if (level === normalized) {
      return level;
    }
  }
  return undefined;
};

/**
 * Compact and complete variants of a group's rules, ready to render on a
 * mobile screen where vertical space is scarce.
 */
export interface RulesMobileSummary {
  /** Each rule truncated so it fits a narrow screen. Pure and deterministic. */
  readonly short: readonly string[];
  /** The original rules, unchanged and in order. Pure and deterministic. */
  readonly full: readonly string[];
}

/** Tuning options for {@link summarizeRulesMobile}. */
export interface SummarizeRulesMobileOptions {
  /**
   * Maximum number of characters per rule in the `short` variant, counting the
   * trailing ellipsis. Non-finite values fall back to the default budget and
   * values below one are treated as one.
   */
  readonly maxChars?: number;
}

/**
 * Default per-rule character budget for the `short` variant.
 * Pure and deterministic.
 */
export const DEFAULT_RULES_MOBILE_MAX_CHARS = 60;

/** Horizontal ellipsis (U+2026) appended when a rule is cut. */
const ELLIPSIS = "…";

/**
 * Builds a mobile-friendly summary of a rule list. Rules longer than the
 * character budget are cut and suffixed with a single ellipsis character so the
 * result never exceeds `maxChars`; shorter rules pass through untouched. The
 * `full` variant is an independent copy of the input, preserving order.
 *
 * A fractional `maxChars` is floored, values below one are treated as one, and
 * non-finite values fall back to the default budget.
 * Pure and deterministic.
 */
export const summarizeRulesMobile = (
  rules: readonly string[],
  options?: SummarizeRulesMobileOptions,
): RulesMobileSummary => {
  const requested = options?.maxChars ?? DEFAULT_RULES_MOBILE_MAX_CHARS;
  const maxChars = Number.isFinite(requested)
    ? Math.max(1, Math.floor(requested))
    : DEFAULT_RULES_MOBILE_MAX_CHARS;
  const short = rules.map((rule) =>
    rule.length <= maxChars
      ? rule
      : `${rule.slice(0, maxChars - 1)}${ELLIPSIS}`,
  );
  return { short, full: [...rules] };
};

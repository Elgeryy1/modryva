/**
 * Recognized moderation actions in a controlled natural-language rule.
 * Pure data type; no runtime behavior.
 */
export type RuleAction = "bloquear" | "permitir" | "silenciar";

/**
 * Recognized content targets a rule can act upon.
 * Pure data type; no runtime behavior.
 */
export type RuleTarget = "links" | "media" | "menciones";

/**
 * Recognized audience scope a rule applies to.
 * Pure data type; no runtime behavior.
 */
export type RuleScope = "nuevos" | "todos";

/**
 * Structured result of parsing a controlled Spanish rule. Optional fields are
 * omitted (never set to undefined) when the corresponding token is absent.
 * `ok` is true only when both an action and a target were recognized.
 * Pure data type; no runtime behavior.
 */
export interface NaturalRule {
  readonly action?: RuleAction;
  readonly target?: RuleTarget;
  readonly scope?: RuleScope;
  readonly durationMs?: number;
  readonly ok: boolean;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const ACTION_TERMS: readonly (readonly [string, RuleAction])[] = [
  ["bloquea", "bloquear"],
  ["prohib", "bloquear"],
  ["permit", "permitir"],
  ["silenci", "silenciar"],
  ["mutea", "silenciar"],
];

const TARGET_TERMS: readonly (readonly [string, RuleTarget])[] = [
  ["enlaces", "links"],
  ["enlace", "links"],
  ["links", "links"],
  ["link", "links"],
  ["multimedia", "media"],
  ["media", "media"],
  ["fotos", "media"],
  ["imagenes", "media"],
  ["videos", "media"],
  ["menciones", "menciones"],
  ["mencion", "menciones"],
];

const SCOPE_TERMS: readonly (readonly [string, RuleScope])[] = [
  ["nuevos", "nuevos"],
  ["nuevo", "nuevos"],
  ["todos", "todos"],
  ["todo", "todos"],
];

/**
 * Lowercases and strips diacritics so accented input matches plain-ASCII terms.
 * Pure and deterministic.
 */
const normalize = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Returns the value of the first term whose keyword appears in the normalized
 * text, preserving the term list order; undefined when none match.
 * Pure and deterministic.
 */
const findFirst = <T>(
  text: string,
  terms: readonly (readonly [string, T])[],
): T | undefined => {
  for (const [keyword, value] of terms) {
    if (text.includes(keyword)) {
      return value;
    }
  }
  return undefined;
};

/**
 * Parses a "durante N horas|minutos|dias" clause into milliseconds; undefined
 * when the clause is absent or the amount is not a positive integer.
 * Pure and deterministic.
 */
const parseDurationMs = (text: string): number | undefined => {
  const match = /durante\s+(\d+)\s+(horas?|minutos?|dias?)/.exec(text);
  if (!match) {
    return undefined;
  }
  const rawAmount = match[1] ?? "";
  const unit = match[2] ?? "";
  const amount = Number.parseInt(rawAmount, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  if (unit.startsWith("hora")) {
    return amount * HOUR_MS;
  }
  if (unit.startsWith("minuto")) {
    return amount * MINUTE_MS;
  }
  return amount * DAY_MS;
};

/**
 * Parses a controlled Spanish configuration sentence such as
 * "bloquea links de usuarios nuevos durante 24 horas" into a structured rule.
 * `ok` is true only when both an action and a target were recognized. Optional
 * fields are omitted via conditional spread, never assigned undefined.
 * Pure and deterministic.
 */
export const parseNaturalRule = (text: string | undefined): NaturalRule => {
  if (!text) {
    return { ok: false };
  }
  const normalized = normalize(text);
  const action = findFirst(normalized, ACTION_TERMS);
  const target = findFirst(normalized, TARGET_TERMS);
  const scope = findFirst(normalized, SCOPE_TERMS);
  const durationMs = parseDurationMs(normalized);
  const ok = action !== undefined && target !== undefined;
  return {
    ...(action !== undefined ? { action } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ok,
  };
};

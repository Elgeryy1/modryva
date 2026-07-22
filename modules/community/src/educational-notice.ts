export interface EducationalNoticeInput {
  /** The community rule being explained, in plain text. */
  readonly rule: string;
  /** The reason the rule exists, in plain text (may be empty). */
  readonly why: string;
}

/** Sentence-ending punctuation marks recognized when normalizing text. */
const TERMINATORS: readonly string[] = [".", "!", "?"];

/** Friendly generic reminder used when no concrete rule is supplied. */
const GENERIC_NOTICE =
  "📘 Recordatorio: sigamos las normas de la comunidad para que todos estemos a gusto. 🙌";

/**
 * Uppercases the first character of a non-empty string, leaving the rest intact.
 * Pure and deterministic.
 */
const capitalizeFirst = (text: string): string => {
  const first = text.charAt(0);
  return first.toUpperCase() + text.slice(1);
};

/**
 * Trims the text, capitalizes its first character, and ensures it ends with
 * sentence punctuation. Returns an empty string for blank input.
 * Pure and deterministic.
 */
const asSentence = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const capitalized = capitalizeFirst(trimmed);
  const last = capitalized.charAt(capitalized.length - 1);
  return TERMINATORS.includes(last) ? capitalized : `${capitalized}.`;
};

/**
 * Builds a single, friendly Spanish educational notice that states a community
 * rule and, when provided, the reason it exists, instead of a blunt ban message.
 * Falls back to a generic reminder when the rule is blank. Both fields are
 * trimmed, capitalized, and punctuated for a consistent tone.
 * Pure and deterministic.
 */
export const buildEducationalNotice = (
  input: EducationalNoticeInput,
): string => {
  const rule = asSentence(input.rule);
  const why = asSentence(input.why);
  if (rule.length === 0) {
    return GENERIC_NOTICE;
  }
  const lines: string[] = ["📘 Aviso de la comunidad", "", `📌 Norma: ${rule}`];
  if (why.length > 0) {
    lines.push(`💡 Por qué existe: ${why}`);
  }
  lines.push(
    "",
    "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
  );
  return lines.join("\n");
};

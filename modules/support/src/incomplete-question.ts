/**
 * Incomplete-question detector for support (F5 / help flow). Before escalating
 * a user question to the staff, it checks that the user gave enough
 * information: sufficient detail, the concrete error or problem, and their
 * system or version. Pure logic: no I/O, network, clock or randomness. Callers
 * pass the plain user text and it reports which data are still missing so the
 * bot can ask for more before bothering an agent.
 */

/**
 * Result of assessing a question. `complete` is true only when nothing is
 * missing. `missing` holds the user-facing Spanish hints in a fixed order
 * (detail, error, context), ready to be shown in chat. Pure and deterministic.
 */
export interface CompletenessAssessment {
  readonly complete: boolean;
  readonly missing: readonly string[];
}

/** Internal shape of the hint table. Not exported. */
interface QuestionHints {
  readonly detail: string;
  readonly error: string;
  readonly context: string;
}

/**
 * User-facing Spanish hints shown when a datum is missing. Exported so UIs and
 * tests reuse the exact accented text instead of duplicating it. Pure and
 * deterministic (a constant table).
 */
export const QUESTION_HINTS: QuestionHints = {
  detail: "Cuéntanos con más detalle qué ocurre; una sola palabra no basta. 📝",
  error: "¿Qué error o mensaje exacto ves? Copia el texto si puedes. ⚠️",
  context: "Indica tu sistema o versión (Android, iOS, versión de la app). 📱",
};

/** Minimum word count for a message to count as detailed enough. */
const MIN_DETAIL_WORDS = 5;

/** Terms that signal the user described an error or problem (accent-free). */
const ERROR_TERMS: readonly string[] = [
  "error",
  "falla",
  "fallo",
  "no funciona",
  "no puedo",
  "no me deja",
  "no carga",
  "no abre",
  "se cierra",
  "se cuelga",
  "bug",
  "problema",
  "crash",
  "mensaje",
];

/** Terms that signal the user gave a system or version (accent-free). */
const CONTEXT_TERMS: readonly string[] = [
  "version",
  "android",
  "ios",
  "iphone",
  "ipad",
  "windows",
  "macos",
  "linux",
  "navegador",
  "chrome",
  "safari",
  "firefox",
  "sistema",
];

/** Matches a version number such as "2.3" or "3.1.4". */
const VERSION_NUMBER = /\d+\.\d+/;

/**
 * Normalizes text for comparison: lowercases and strips diacritics so that
 * "version" and its accented form match the same term. Used only as an
 * internal key; the shown text keeps its original form. Pure and deterministic.
 */
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Counts words: trims, then splits on whitespace ignoring empty tokens. An
 * empty or blank string yields 0. Pure and deterministic.
 */
const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

/**
 * Assesses whether a question carries enough information for the staff. Flags
 * as missing, in a fixed order, the detail (message too short), the concrete
 * error or problem, and the system or version. An empty or `undefined` text
 * counts as missing everything. Returns the user-facing hints for the missing
 * data. Pure and deterministic.
 */
export const assessQuestionCompleteness = (
  text: string | undefined,
): CompletenessAssessment => {
  const raw = text ?? "";
  const normalized = normalize(raw);
  const missing: string[] = [];

  if (countWords(raw) < MIN_DETAIL_WORDS) {
    missing.push(QUESTION_HINTS.detail);
  }

  const hasError = ERROR_TERMS.some((term) => normalized.includes(term));
  if (!hasError) {
    missing.push(QUESTION_HINTS.error);
  }

  const hasContext =
    CONTEXT_TERMS.some((term) => normalized.includes(term)) ||
    VERSION_NUMBER.test(normalized);
  if (!hasContext) {
    missing.push(QUESTION_HINTS.context);
  }

  return { complete: missing.length === 0, missing };
};

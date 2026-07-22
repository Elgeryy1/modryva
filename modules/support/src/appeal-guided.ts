/**
 * Guided appeal flow for banned/muted users: a fixed, ordered set of steps that
 * walks the appellant through "what happened", "why", and "what you learned",
 * plus a keyword heuristic that classifies the free-text appeal and a validator
 * that rejects empty / too-short / insult-only answers. Pure logic: no I/O, no
 * Prisma, no gateway, no clock, no randomness. Every input arrives as a plain
 * parameter and every output is a plain value, so results are deterministic.
 */

/** One step in the guided appeal wizard. Ordered; `id` is stable and unique. */
export interface AppealStep {
  readonly id: string;
  readonly question: string;
}

/**
 * The ordered appeal steps. The wizard asks these one at a time, in array
 * order: what happened, why it happened, and what the user learned.
 */
export const APPEAL_STEPS: readonly AppealStep[] = [
  {
    id: "what",
    question: "Que paso? Cuenta con tus palabras que ocurrio.",
  },
  {
    id: "why",
    question: "Por que crees que se tomo esta accion contra ti?",
  },
  {
    id: "learned",
    question: "Que aprendiste y como evitaras que se repita?",
  },
];

/**
 * Returns the id of the step that follows `currentId`, or null when `currentId`
 * is the last step or is not a known step id. Pure and deterministic.
 */
export const nextAppealStep = (currentId: string): string | null => {
  const index = APPEAL_STEPS.findIndex((step) => step.id === currentId);
  if (index === -1 || index >= APPEAL_STEPS.length - 1) {
    return null;
  }
  const next = APPEAL_STEPS[index + 1];
  return next ? next.id : null;
};

/** The category a free-text appeal falls into, by keyword heuristic. */
export type AppealKind = "error" | "arrepentimiento" | "abuso" | "confusion";

/** The classification verdict: a discriminated-by-value kind plus a 0..1 score. */
export interface AppealClassification {
  readonly kind: AppealKind;
  readonly confidence: number;
}

/**
 * A weighted keyword signal. Redefined structurally here (not imported) so this
 * module has no cross-module coupling.
 */
interface AppealSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Insults aimed at the staff/moderation. Presence forces the "abuso" kind. */
const ABUSE_KEYWORDS: readonly string[] = [
  "idiota",
  "imbecil",
  "estupido",
  "estupida",
  "gilipollas",
  "cabron",
  "cabrona",
  "puto",
  "puta",
  "mierda",
  "basura",
  "inutil",
  "payaso",
  "corrupto",
  "abusador",
  "tirano",
  "incompetente",
];

/** Claims the moderation was a mistake / the user did nothing wrong. */
const ERROR_KEYWORDS: readonly string[] = [
  "error",
  "equivocacion",
  "injusto",
  "injusta",
  "inocente",
  "no hice nada",
  "no fui yo",
  "falso positivo",
  "por error",
  "sin razon",
  "no rompi",
];

/** Owns the mistake and asks for another chance. */
const REGRET_KEYWORDS: readonly string[] = [
  "perdon",
  "disculpa",
  "disculpas",
  "lo siento",
  "me equivoque",
  "mi culpa",
  "no volvera a pasar",
  "prometo",
  "aprendi",
  "arrepiento",
  "arrepentido",
  "una oportunidad",
  "segunda oportunidad",
];

/** Does not understand what happened / why. */
const CONFUSION_KEYWORDS: readonly string[] = [
  "no entiendo",
  "no se por que",
  "no se porque",
  "que paso",
  "por que",
  "porque me",
  "confundido",
  "confundida",
  "no comprendo",
  "no me explico",
  "que hice",
];

/** Normalizes text for keyword matching: lowercased, collapsed whitespace. */
const normalizeAppealText = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

const countHits = (haystack: string, keywords: readonly string[]): number => {
  let hits = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      hits += 1;
    }
  }
  return hits;
};

/**
 * Classifies a free-text appeal by keyword heuristic. Rules, in priority order:
 * insults toward the staff always win and yield `"abuso"`; otherwise the kind
 * with the most keyword hits wins, ties broken by the order error >
 * arrepentimiento > confusion; with no hits at all the result is `"confusion"`
 * with confidence 0. `confidence` is 0..1, growing with the number of hits for
 * the winning kind. Pure and deterministic.
 */
export const classifyAppeal = (text: string): AppealClassification => {
  const haystack = normalizeAppealText(text);

  const abuseHits = countHits(haystack, ABUSE_KEYWORDS);
  if (abuseHits > 0) {
    return {
      kind: "abuso",
      confidence: Math.min(1, 0.6 + 0.2 * (abuseHits - 1)),
    };
  }

  const signals: readonly AppealSignal[] = [
    {
      key: "error",
      weight: countHits(haystack, ERROR_KEYWORDS),
      present: false,
    },
    {
      key: "arrepentimiento",
      weight: countHits(haystack, REGRET_KEYWORDS),
      present: false,
    },
    {
      key: "confusion",
      weight: countHits(haystack, CONFUSION_KEYWORDS),
      present: false,
    },
  ];

  let best: AppealSignal | undefined = signals[0];
  for (const signal of signals) {
    if (best === undefined || signal.weight > best.weight) {
      best = signal;
    }
  }

  if (best === undefined || best.weight === 0) {
    return { kind: "confusion", confidence: 0 };
  }

  return {
    kind: best.key as AppealKind,
    confidence: Math.min(1, 0.4 + 0.2 * best.weight),
  };
};

/** The minimum number of "real" characters a valid answer must have. */
export const APPEAL_ANSWER_MIN_LENGTH = 15;

/** Result of validating a single wizard answer. */
export type AppealAnswerValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly hint: string };

/**
 * Validates one free-text answer to a wizard step. Rejects: empty or
 * whitespace-only input; answers shorter than {@link APPEAL_ANSWER_MIN_LENGTH}
 * once trimmed; and answers that are only insults toward the staff (an insult
 * plus a substantive explanation is accepted). Returns a Spanish-neutral hint
 * on failure. Pure and deterministic.
 */
export const validateAppealAnswer = (
  answer: string,
): AppealAnswerValidation => {
  const trimmed = answer.trim();

  if (trimmed.length === 0) {
    return { ok: false, hint: "La respuesta no puede estar vacia." };
  }

  if (trimmed.length < APPEAL_ANSWER_MIN_LENGTH) {
    return {
      ok: false,
      hint: `Explica un poco mas (minimo ${APPEAL_ANSWER_MIN_LENGTH} caracteres).`,
    };
  }

  const normalized = normalizeAppealText(trimmed);
  const words = normalized.split(" ").filter((word) => word.length > 0);
  const insultWords = words.filter((word) =>
    ABUSE_KEYWORDS.some((insult) => word.includes(insult)),
  );
  const cleanWords = words.length - insultWords.length;

  if (insultWords.length > 0 && cleanWords < 2) {
    return {
      ok: false,
      hint: "Explica tu caso sin insultar al equipo.",
    };
  }

  return { ok: true };
};

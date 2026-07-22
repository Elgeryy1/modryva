import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type QuizCommand = {
  readonly kind: "create";
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
};

export interface QuizCommandError {
  readonly code: "format";
  readonly usage: string;
}

export type QuizCommandResult =
  | { readonly ok: true; readonly command: QuizCommand }
  | { readonly ok: false; readonly error: QuizCommandError };

const quizUsage = "Uso: /quiz Pregunta | Correcta | Incorrecta [| ...]";

/**
 * Parses a `/quiz` command of the form
 * `/quiz Pregunta | Correcta | Incorrecta1 | Incorrecta2 [| ...]`.
 *
 * The parts are split on `|`, trimmed and empties dropped. The first part is the
 * question, the second is the correct option, and the rest are wrong options.
 * Requires a question plus at least 2 total options (1 correct + >=1 wrong) and
 * at most 10 options total. Returns null when the command is not `quiz`.
 *
 * The returned `options` are ordered with the correct answer at index 0; the
 * pure parser does NOT randomize. Use `orderQuizOptions` to shuffle
 * deterministically.
 */
export const parseQuizCommand = (
  update: TelegramUpdateEnvelope,
): QuizCommandResult | null => {
  if (update.command?.name !== "quiz") {
    return null;
  }

  const raw = (update.command?.args ?? []).join(" ").trim();
  const parts = raw
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const [question, correct, ...wrong] = parts;

  if (!question || !correct || wrong.length < 1) {
    return { ok: false, error: { code: "format", usage: quizUsage } };
  }

  const options = [correct, ...wrong];

  if (options.length > 10) {
    return { ok: false, error: { code: "format", usage: quizUsage } };
  }

  return {
    ok: true,
    command: { kind: "create", question, options, correctIndex: 0 },
  };
};

/**
 * Deterministically places `correct` at index `seed % (wrong.length + 1)` among
 * the assembled options and returns the ordered list together with the
 * resulting `correctIndex`. Pure: identical inputs always yield identical
 * output.
 */
export const orderQuizOptions = (
  correct: string,
  wrong: readonly string[],
  seed: number,
): { options: string[]; correctIndex: number } => {
  const total = wrong.length + 1;
  const normalizedSeed =
    Number.isInteger(seed) && seed >= 0 ? seed : Math.abs(Math.trunc(seed));
  const correctIndex = normalizedSeed % total;

  const options: string[] = [];
  let wrongCursor = 0;

  for (let index = 0; index < total; index += 1) {
    if (index === correctIndex) {
      options.push(correct);
    } else {
      options.push(wrong[wrongCursor] ?? "");
      wrongCursor += 1;
    }
  }

  return { options, correctIndex };
};

/**
 * Parses a quiz-answer callback of the form `quiz:<sessionId>:<optionIndex>`.
 * Returns null when the callback is not a quiz answer or is malformed.
 */
export const parseQuizAnswer = (
  callbackData: string | undefined,
): { sessionId: string; optionIndex: number } | null => {
  if (!callbackData?.startsWith("quiz:")) {
    return null;
  }

  const [, sessionId, rawIndex] = callbackData.split(":");
  const optionIndex = Number.parseInt(rawIndex ?? "", 10);

  if (!sessionId || !Number.isInteger(optionIndex) || optionIndex < 0) {
    return null;
  }

  return { sessionId, optionIndex };
};

/**
 * Returns true when the answered option matches the correct option index.
 */
export const isQuizCorrect = (
  correctIndex: number,
  optionIndex: number,
): boolean => correctIndex === optionIndex;

/**
 * True when the command is a quiz/trivia leaderboard request.
 */
export const isQuizScoresCommand = (name: string | undefined): boolean =>
  name === "quizscores" || name === "quiztop" || name === "trivialeaderboard";

/**
 * Formats a QuizBot-style leaderboard from top scores, with podium medals.
 */
export const formatQuizLeaderboard = (
  rows: readonly {
    readonly telegramUserId: bigint;
    readonly points: number;
  }[],
  names: Readonly<Record<string, string>> = {},
): string => {
  if (rows.length === 0) {
    return "Aun no hay puntuaciones. Juega con /quiz o /trivia.";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.map((row, index) => {
    const rank = medals[index] ?? `${index + 1}.`;
    const who =
      names[row.telegramUserId.toString()] ?? row.telegramUserId.toString();
    return `${rank} ${who} — ${row.points} pts`;
  });

  return `🏆 *Clasificacion de juegos*\n${lines.join("\n")}`;
};

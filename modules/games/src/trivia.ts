import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { TRIVIA_BANK } from "./trivia-bank.js";

export interface TriviaQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly category?: string;
  readonly difficulty?: "facil" | "media" | "dificil";
}

export const TRIVIA_QUESTIONS: readonly TriviaQuestion[] = TRIVIA_BANK;

/** Deterministic question selection so a seed always yields the same question. */
export const pickQuestionIndex = (seed: number, count: number): number => {
  if (count <= 0) {
    return 0;
  }
  const normalized = Math.abs(Math.trunc(seed)) % count;
  return normalized;
};

export type TriviaCommand = { readonly kind: "start" };

export type TriviaCommandResult = {
  readonly ok: true;
  readonly command: TriviaCommand;
};

export const parseTriviaCommand = (
  update: TelegramUpdateEnvelope,
): TriviaCommandResult | null => {
  if (update.command?.name !== "trivia") {
    return null;
  }
  return { ok: true, command: { kind: "start" } };
};

/** Parses a trivia answer callback `trivia:<sessionId>:<optionIndex>`. */
export const parseTriviaAnswer = (
  callbackData: string | undefined,
): { sessionId: string; optionIndex: number } | null => {
  if (!callbackData?.startsWith("trivia:")) {
    return null;
  }
  const [, sessionId, rawIndex] = callbackData.split(":");
  const optionIndex = Number.parseInt(rawIndex ?? "", 10);
  if (!sessionId || !Number.isInteger(optionIndex) || optionIndex < 0) {
    return null;
  }
  return { sessionId, optionIndex };
};

export const isCorrectAnswer = (
  question: TriviaQuestion,
  optionIndex: number,
): boolean => optionIndex === question.correctIndex;

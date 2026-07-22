import type { TelegramUpdateEnvelope } from "@superbot/domain";

export interface PollDraft {
  readonly question: string;
  readonly options: readonly string[];
}

export type PollCommand = {
  readonly kind: "create";
  readonly draft: PollDraft;
};

export interface PollCommandError {
  readonly code: "format";
  readonly usage: string;
}

export type PollCommandResult =
  | { readonly ok: true; readonly command: PollCommand }
  | { readonly ok: false; readonly error: PollCommandError };

const pollUsage =
  "Uso: /poll Pregunta | Opcion 1 | Opcion 2 [| Opcion 3 ...] (2-10 opciones)";

export const parsePollCommand = (
  update: TelegramUpdateEnvelope,
): PollCommandResult | null => {
  if (update.command?.name !== "poll") {
    return null;
  }

  const raw = (update.command?.args ?? []).join(" ").trim();
  const parts = raw
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const [question, ...options] = parts;

  if (!question || options.length < 2 || options.length > 10) {
    return { ok: false, error: { code: "format", usage: pollUsage } };
  }

  return {
    ok: true,
    command: { kind: "create", draft: { question, options } },
  };
};

export interface PollVote {
  readonly optionIndex: number;
}

/**
 * Counts votes per option. Votes referencing an out-of-range option are ignored,
 * so a tampered callback cannot corrupt the tally.
 */
export const tallyVotes = (
  votes: readonly PollVote[],
  optionCount: number,
): number[] => {
  const tally = new Array<number>(optionCount).fill(0);

  for (const vote of votes) {
    if (
      Number.isInteger(vote.optionIndex) &&
      vote.optionIndex >= 0 &&
      vote.optionIndex < optionCount
    ) {
      tally[vote.optionIndex] = (tally[vote.optionIndex] ?? 0) + 1;
    }
  }

  return tally;
};

export const formatPollResults = (
  question: string,
  options: readonly string[],
  tally: readonly number[],
): string => {
  const total = tally.reduce((sum, value) => sum + value, 0);
  const lines = options.map((option, index) => {
    const count = tally[index] ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `${option}: ${count} (${pct}%)`;
  });

  return `${question}\n${lines.join("\n")}\nTotal de votos: ${total}`;
};

/**
 * Parses a poll-vote callback of the form `poll:<pollId>:<optionIndex>`. Returns
 * null when the callback is not a poll vote or is malformed.
 */
export const parsePollVote = (
  callbackData: string | undefined,
): { pollId: string; optionIndex: number } | null => {
  if (!callbackData?.startsWith("poll:")) {
    return null;
  }

  const [, pollId, rawIndex] = callbackData.split(":");
  const optionIndex = Number.parseInt(rawIndex ?? "", 10);

  if (!pollId || !Number.isInteger(optionIndex) || optionIndex < 0) {
    return null;
  }

  return { pollId, optionIndex };
};

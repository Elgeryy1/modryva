import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  formatQuizLeaderboard,
  isQuizCorrect,
  isQuizScoresCommand,
  orderQuizOptions,
  parseQuizAnswer,
  parseQuizCommand,
} from "./quizzes.js";

const emptyContent: MessageContentFlags = {
  hasText: false,
  hasUrl: false,
  hasMention: false,
  isForward: false,
  viaBot: false,
  hasPhoto: false,
  hasVideo: false,
  hasAnimation: false,
  hasSticker: false,
  hasAudio: false,
  hasVoice: false,
  hasDocument: false,
  hasContact: false,
  hasLocation: false,
  hasPoll: false,
};

const buildCommandUpdate = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args },
  callbackData: undefined,
  messageText: undefined,
  content: emptyContent,
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 1,
  newChatMemberIds: [],
  isTextMessage: false,
  raw: {},
});

describe("parseQuizCommand", () => {
  it("parses a question with a correct and one wrong option", () => {
    expect(
      parseQuizCommand(
        buildCommandUpdate("quiz", [
          "Capital de Francia?",
          "|",
          "Paris",
          "|",
          "Londres",
        ]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "create",
        question: "Capital de Francia?",
        options: ["Paris", "Londres"],
        correctIndex: 0,
      },
    });
  });

  it("parses multiple wrong options keeping the correct one first", () => {
    expect(
      parseQuizCommand(
        buildCommandUpdate("quiz", ["2 + 2?", "| 4 | 3 | 5 | 22"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "create",
        question: "2 + 2?",
        options: ["4", "3", "5", "22"],
        correctIndex: 0,
      },
    });
  });

  it("drops empty parts before validating", () => {
    expect(
      parseQuizCommand(
        buildCommandUpdate("quiz", ["P", "|", "C", "|", "", "|", "W"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "create",
        question: "P",
        options: ["C", "W"],
        correctIndex: 0,
      },
    });
  });

  it("rejects when there is no wrong option", () => {
    expect(
      parseQuizCommand(buildCommandUpdate("quiz", ["Pregunta", "|", "Sola"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("rejects when only a question is given", () => {
    expect(
      parseQuizCommand(buildCommandUpdate("quiz", ["Solo pregunta"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("rejects more than 10 total options", () => {
    const wrong = Array.from({ length: 10 }, (_, i) => `W${i}`);
    const args = ["Q", "|", "Correcta", ...wrong.flatMap((w) => ["|", w])];
    const result = parseQuizCommand(buildCommandUpdate("quiz", args));
    expect(result).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("accepts exactly 10 total options", () => {
    const wrong = Array.from({ length: 9 }, (_, i) => `W${i}`);
    const args = ["Q", "|", "Correcta", ...wrong.flatMap((w) => ["|", w])];
    const result = parseQuizCommand(buildCommandUpdate("quiz", args));
    expect(result).toMatchObject({
      ok: true,
      command: { kind: "create", correctIndex: 0 },
    });
    if (result?.ok) {
      expect(result.command.options).toHaveLength(10);
    }
  });

  it("exposes a Spanish usage string on bad format", () => {
    const result = parseQuizCommand(buildCommandUpdate("quiz", ["Q"]));
    expect(result).toEqual({
      ok: false,
      error: {
        code: "format",
        usage: "Uso: /quiz Pregunta | Correcta | Incorrecta [| ...]",
      },
    });
  });

  it("returns null for other commands", () => {
    expect(parseQuizCommand(buildCommandUpdate("poll"))).toBeNull();
    expect(parseQuizCommand(buildCommandUpdate("ban"))).toBeNull();
  });
});

describe("orderQuizOptions", () => {
  it("places the correct answer at seed % (wrong.length + 1)", () => {
    const wrong = ["A", "B", "C"];
    expect(orderQuizOptions("OK", wrong, 0)).toEqual({
      options: ["OK", "A", "B", "C"],
      correctIndex: 0,
    });
    expect(orderQuizOptions("OK", wrong, 1)).toEqual({
      options: ["A", "OK", "B", "C"],
      correctIndex: 1,
    });
    expect(orderQuizOptions("OK", wrong, 2)).toEqual({
      options: ["A", "B", "OK", "C"],
      correctIndex: 2,
    });
    expect(orderQuizOptions("OK", wrong, 3)).toEqual({
      options: ["A", "B", "C", "OK"],
      correctIndex: 3,
    });
  });

  it("wraps the seed modulo the option count and stays in range", () => {
    const wrong = ["A", "B"];
    const total = wrong.length + 1;
    for (const seed of [0, 1, 2, 3, 4, 5, 100, 7919]) {
      const { options, correctIndex } = orderQuizOptions("OK", wrong, seed);
      expect(correctIndex).toBe(seed % total);
      expect(correctIndex).toBeGreaterThanOrEqual(0);
      expect(correctIndex).toBeLessThan(total);
      expect(options).toHaveLength(total);
      expect(options[correctIndex]).toBe("OK");
    }
  });

  it("is deterministic for identical inputs", () => {
    const first = orderQuizOptions("OK", ["A", "B", "C"], 5);
    const second = orderQuizOptions("OK", ["A", "B", "C"], 5);
    expect(first).toEqual(second);
  });

  it("preserves the relative order of wrong options", () => {
    const { options, correctIndex } = orderQuizOptions(
      "OK",
      ["A", "B", "C"],
      2,
    );
    const remaining = options.filter((_, i) => i !== correctIndex);
    expect(remaining).toEqual(["A", "B", "C"]);
  });

  it("handles a single wrong option", () => {
    expect(orderQuizOptions("OK", ["A"], 0)).toEqual({
      options: ["OK", "A"],
      correctIndex: 0,
    });
    expect(orderQuizOptions("OK", ["A"], 1)).toEqual({
      options: ["A", "OK"],
      correctIndex: 1,
    });
  });

  it("normalizes negative or non-integer seeds into range", () => {
    const wrong = ["A", "B"];
    const total = wrong.length + 1;
    for (const seed of [-1, -4, 2.7, -3.2]) {
      const { correctIndex, options } = orderQuizOptions("OK", wrong, seed);
      expect(correctIndex).toBeGreaterThanOrEqual(0);
      expect(correctIndex).toBeLessThan(total);
      expect(options[correctIndex]).toBe("OK");
    }
  });
});

describe("parseQuizAnswer", () => {
  it("parses a valid answer callback", () => {
    expect(parseQuizAnswer("quiz:sess1:2")).toEqual({
      sessionId: "sess1",
      optionIndex: 2,
    });
  });

  it("parses index zero", () => {
    expect(parseQuizAnswer("quiz:abc:0")).toEqual({
      sessionId: "abc",
      optionIndex: 0,
    });
  });

  it("returns null for non-quiz callbacks", () => {
    expect(parseQuizAnswer("poll:abc:2")).toBeNull();
    expect(parseQuizAnswer("menu:status")).toBeNull();
    expect(parseQuizAnswer(undefined)).toBeNull();
  });

  it("returns null for malformed callbacks", () => {
    expect(parseQuizAnswer("quiz::2")).toBeNull();
    expect(parseQuizAnswer("quiz:abc:")).toBeNull();
    expect(parseQuizAnswer("quiz:abc:x")).toBeNull();
    expect(parseQuizAnswer("quiz:abc:-1")).toBeNull();
  });
});

describe("isQuizCorrect", () => {
  it("returns true when the indices match", () => {
    expect(isQuizCorrect(2, 2)).toBe(true);
    expect(isQuizCorrect(0, 0)).toBe(true);
  });

  it("returns false when the indices differ", () => {
    expect(isQuizCorrect(2, 1)).toBe(false);
    expect(isQuizCorrect(0, 3)).toBe(false);
  });
});

describe("quiz leaderboard", () => {
  it("detects the scores command aliases", () => {
    expect(isQuizScoresCommand("quizscores")).toBe(true);
    expect(isQuizScoresCommand("quiztop")).toBe(true);
    expect(isQuizScoresCommand("quiz")).toBe(false);
    expect(isQuizScoresCommand(undefined)).toBe(false);
  });

  it("formats a leaderboard with medals and names", () => {
    const s = formatQuizLeaderboard(
      [
        { telegramUserId: 1n, points: 5 },
        { telegramUserId: 2n, points: 3 },
      ],
      { "1": "@ada" },
    );
    expect(s).toContain("🥇 @ada — 5 pts");
    expect(s).toContain("🥈 2 — 3 pts");
    expect(formatQuizLeaderboard([])).toContain("Aun no hay");
  });
});

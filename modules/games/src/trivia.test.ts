import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  isCorrectAnswer,
  parseTriviaAnswer,
  parseTriviaCommand,
  pickQuestionIndex,
  TRIVIA_QUESTIONS,
} from "./trivia.js";

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

const buildCommandUpdate = (name: string): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args: [] },
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

describe("trivia question bank", () => {
  it("has consistent questions with valid correct indices", () => {
    expect(TRIVIA_QUESTIONS.length).toBeGreaterThan(0);
    for (const q of TRIVIA_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
  });
});

describe("pickQuestionIndex", () => {
  it("is deterministic and within range", () => {
    expect(pickQuestionIndex(123, 8)).toBe(pickQuestionIndex(123, 8));
    expect(pickQuestionIndex(123, 8)).toBeLessThan(8);
    expect(pickQuestionIndex(-5, 8)).toBeGreaterThanOrEqual(0);
  });
});

describe("parseTriviaCommand / parseTriviaAnswer", () => {
  it("parses /trivia", () => {
    expect(parseTriviaCommand(buildCommandUpdate("trivia"))).toEqual({
      ok: true,
      command: { kind: "start" },
    });
    expect(parseTriviaCommand(buildCommandUpdate("ban"))).toBeNull();
  });

  it("parses a trivia answer callback", () => {
    expect(parseTriviaAnswer("trivia:gm_1:2")).toEqual({
      sessionId: "gm_1",
      optionIndex: 2,
    });
    expect(parseTriviaAnswer("poll:x:1")).toBeNull();
  });
});

describe("isCorrectAnswer", () => {
  it("compares the option index against the correct index", () => {
    const q = TRIVIA_QUESTIONS[0];
    if (!q) {
      throw new Error("no question");
    }
    expect(isCorrectAnswer(q, q.correctIndex)).toBe(true);
    expect(isCorrectAnswer(q, (q.correctIndex + 1) % q.options.length)).toBe(
      false,
    );
  });
});

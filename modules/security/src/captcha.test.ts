import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";

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

import {
  generateCaptchaChallenge,
  hashCaptchaAnswer,
  parseCaptchaCommand,
  verifyCaptchaAnswer,
} from "./captcha.js";

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

describe("generateCaptchaChallenge", () => {
  it("is deterministic for a given seed", () => {
    const first = generateCaptchaChallenge("math", 1234);
    const second = generateCaptchaChallenge("math", 1234);

    expect(first).toEqual(second);
  });

  it("produces a solvable math challenge", () => {
    const challenge = generateCaptchaChallenge("math", 99);
    const match = /(\d+) \+ (\d+)/u.exec(challenge.prompt);

    expect(match).not.toBeNull();
    const sum = Number(match?.[1]) + Number(match?.[2]);
    expect(challenge.answer).toBe(String(sum));
  });

  it("offers tappable multiple-choice buttons for math (muted-user safe)", () => {
    const challenge = generateCaptchaChallenge("math", 99);
    const correct = challenge.buttons.filter((button) => button.correct);

    // A restricted member cannot type; the answer must be reachable by a tap.
    expect(challenge.buttons.length).toBeGreaterThan(1);
    expect(correct).toHaveLength(1);
    expect(correct[0]?.token).toBe(challenge.answer);
    // No duplicate options.
    const tokens = challenge.buttons.map((button) => button.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("produces a button challenge with exactly one correct option", () => {
    const challenge = generateCaptchaChallenge("button", 7);
    const correct = challenge.buttons.filter((button) => button.correct);

    expect(challenge.buttons.length).toBeGreaterThan(1);
    expect(correct).toHaveLength(1);
    expect(challenge.answer).toBe(correct[0]?.token);
  });

  it("produces a text challenge whose answer matches the code", () => {
    const challenge = generateCaptchaChallenge("text", 42);
    const code = challenge.prompt.split(": ")[1];

    expect(code).toBeDefined();
    expect(challenge.answer).toBe(code?.toLowerCase());
  });
});

describe("captcha answer hashing", () => {
  it("verifies a correct answer and rejects a wrong one (case insensitive)", () => {
    const salt = "session-salt";
    const hash = hashCaptchaAnswer("Ab12C", salt);

    expect(verifyCaptchaAnswer("ab12c", hash, salt)).toBe(true);
    expect(verifyCaptchaAnswer("wrong", hash, salt)).toBe(false);
  });

  it("uses the salt so identical answers hash differently per session", () => {
    expect(hashCaptchaAnswer("7", "salt-a")).not.toBe(
      hashCaptchaAnswer("7", "salt-b"),
    );
  });
});

describe("parseCaptchaCommand", () => {
  it("returns null for unrelated commands", () => {
    expect(parseCaptchaCommand(buildCommandUpdate("start"))).toBeNull();
  });

  it("parses mode changes", () => {
    expect(
      parseCaptchaCommand(buildCommandUpdate("captcha_mode", ["math"])),
    ).toEqual({ ok: true, command: { kind: "mode", mode: "math" } });
  });

  it("rejects an invalid mode", () => {
    expect(
      parseCaptchaCommand(buildCommandUpdate("captcha_mode", ["puzzle"])),
    ).toMatchObject({ ok: false, error: { code: "invalid-mode" } });
  });

  it("rejects a too-small timeout", () => {
    expect(
      parseCaptchaCommand(buildCommandUpdate("captcha_timeout", ["5"])),
    ).toMatchObject({ ok: false, error: { code: "invalid-timeout" } });
  });
});

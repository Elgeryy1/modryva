import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildHumanVerifyButton,
  parseHumanVerifyCallback,
  parseJoinGateCommand,
} from "./join-gate.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 7n, username: "tester", languageCode: "es" },
  command: undefined,
  callbackData: undefined,
  messageText: undefined,
  content: {
    hasText: true,
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
  },
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 555,
  newChatMemberIds: [],
  isTextMessage: true,
  raw: {},
  ...overrides,
});

const cmd = (name: string, args: string[]) => ({
  name,
  raw: `/${name} ${args.join(" ")}`.trim(),
  args,
});

describe("parseJoinGateCommand", () => {
  it("parses welcomemute on/off", () => {
    expect(
      parseJoinGateCommand(baseUpdate({ command: cmd("welcomemute", ["on"]) })),
    ).toEqual({ ok: true, command: { kind: "welcomemute", enabled: true } });
    expect(
      parseJoinGateCommand(
        baseUpdate({ command: cmd("welcomemute", ["off"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "welcomemute", enabled: false } });
  });

  it("parses autoapprove and accepts si/no", () => {
    expect(
      parseJoinGateCommand(baseUpdate({ command: cmd("autoapprove", ["si"]) })),
    ).toEqual({ ok: true, command: { kind: "autoapprove", enabled: true } });
    expect(
      parseJoinGateCommand(baseUpdate({ command: cmd("autoapprove", ["no"]) })),
    ).toEqual({ ok: true, command: { kind: "autoapprove", enabled: false } });
  });

  it("errors on an invalid or missing toggle", () => {
    const bad = parseJoinGateCommand(
      baseUpdate({ command: cmd("welcomemute", ["maybe"]) }),
    );
    expect(bad?.ok).toBe(false);
    const missing = parseJoinGateCommand(
      baseUpdate({ command: cmd("welcomemute", []) }),
    );
    expect(missing?.ok).toBe(false);
  });

  it("returns null for a foreign command", () => {
    expect(
      parseJoinGateCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
    expect(parseJoinGateCommand(baseUpdate())).toBeNull();
  });
});

describe("human verify callback", () => {
  it("builds a button that carries the target id", () => {
    const markup = buildHumanVerifyButton(42n);
    expect(JSON.stringify(markup)).toContain("humanverify:42");
  });

  it("parses a valid callback and rejects others", () => {
    expect(parseHumanVerifyCallback("humanverify:42")).toEqual({
      telegramUserId: 42n,
    });
    expect(parseHumanVerifyCallback("humanverify:abc")).toBeNull();
    expect(parseHumanVerifyCallback("menu:home")).toBeNull();
    expect(parseHumanVerifyCallback(undefined)).toBeNull();
  });
});

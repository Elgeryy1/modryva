import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildFeedbackRelay,
  parseFeedbackCommand,
  parseFeedbackOrigin,
} from "./feedback.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "private", topicId: undefined },
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

describe("parseFeedbackCommand", () => {
  it("parses setfeedback / unsetfeedback", () => {
    expect(
      parseFeedbackCommand(baseUpdate({ command: cmd("setfeedback", []) })),
    ).toEqual({ ok: true, command: { kind: "set-staff" } });
    expect(
      parseFeedbackCommand(baseUpdate({ command: cmd("unsetfeedback", []) })),
    ).toEqual({ ok: true, command: { kind: "unset-staff" } });
  });

  it("parses broadcast and errors when empty", () => {
    expect(
      parseFeedbackCommand(
        baseUpdate({ command: cmd("broadcast", ["hola", "a", "todos"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "broadcast", text: "hola a todos" },
    });
    const empty = parseFeedbackCommand(
      baseUpdate({ command: cmd("broadcast", []) }),
    );
    expect(empty?.ok).toBe(false);
  });

  it("returns null for a foreign command", () => {
    expect(
      parseFeedbackCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
  });
});

describe("feedback relay marker", () => {
  it("round-trips the origin id through the relay text", () => {
    const relay = buildFeedbackRelay("Ada", 12345n, "necesito ayuda");
    expect(relay).toContain("Ada");
    expect(relay).toContain("necesito ayuda");
    expect(parseFeedbackOrigin(relay)).toBe(12345n);
  });

  it("handles negative ids and returns null without a marker", () => {
    const relay = buildFeedbackRelay("X", -42n, "hi");
    expect(parseFeedbackOrigin(relay)).toBe(-42n);
    expect(parseFeedbackOrigin("mensaje normal sin marca")).toBeNull();
    expect(parseFeedbackOrigin(undefined)).toBeNull();
  });
});

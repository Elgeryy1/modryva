import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  isTypeLockedInTopic,
  normalizeTopicKey,
  parseTopicScopeCommand,
  resolveTopicConfig,
  type TopicScopedConfig,
} from "./topic-scoping.js";

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

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

interface DemoConfig {
  readonly slowmode: number;
  readonly nsfw: boolean;
  readonly lockedTypes: readonly string[];
}

const demoScoped: TopicScopedConfig<DemoConfig> = {
  base: { slowmode: 0, nsfw: false, lockedTypes: [] },
  overrides: {
    "10": { slowmode: 30, lockedTypes: ["sticker", "photo"] },
    "20": { nsfw: true },
  },
};

describe("normalizeTopicKey", () => {
  it("returns undefined for the general thread (undefined)", () => {
    expect(normalizeTopicKey(undefined)).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTopicKey("  42  ")).toBe("42");
  });

  it("returns undefined for blank ids", () => {
    expect(normalizeTopicKey("   ")).toBeUndefined();
    expect(normalizeTopicKey("")).toBeUndefined();
  });
});

describe("resolveTopicConfig", () => {
  it("returns a copy of the base for the general thread", () => {
    expect(resolveTopicConfig(demoScoped, undefined)).toEqual({
      slowmode: 0,
      nsfw: false,
      lockedTypes: [],
    });
  });

  it("returns the base for a topic without override", () => {
    expect(resolveTopicConfig(demoScoped, "999")).toEqual({
      slowmode: 0,
      nsfw: false,
      lockedTypes: [],
    });
  });

  it("merges base with the topic override (override wins per key)", () => {
    expect(resolveTopicConfig(demoScoped, "10")).toEqual({
      slowmode: 30,
      nsfw: false,
      lockedTypes: ["sticker", "photo"],
    });
  });

  it("keeps base keys not present in the override", () => {
    expect(resolveTopicConfig(demoScoped, "20")).toEqual({
      slowmode: 0,
      nsfw: true,
      lockedTypes: [],
    });
  });

  it("normalizes the topic id before lookup", () => {
    expect(resolveTopicConfig(demoScoped, "  10 ")).toEqual({
      slowmode: 30,
      nsfw: false,
      lockedTypes: ["sticker", "photo"],
    });
  });

  it("does not mutate the base config", () => {
    const resolved = resolveTopicConfig(demoScoped, "10");
    expect(resolved).not.toBe(demoScoped.base);
    expect(demoScoped.base).toEqual({
      slowmode: 0,
      nsfw: false,
      lockedTypes: [],
    });
  });
});

describe("isTypeLockedInTopic", () => {
  const lockScoped: TopicScopedConfig<{
    readonly lockedTypes: readonly string[];
  }> = {
    base: { lockedTypes: ["url"] },
    overrides: { "10": { lockedTypes: ["sticker", "photo"] } },
  };

  it("uses the topic override list", () => {
    expect(isTypeLockedInTopic(lockScoped, "10", "sticker")).toBe(true);
    expect(isTypeLockedInTopic(lockScoped, "10", "photo")).toBe(true);
  });

  it("returns false for a type not locked in that topic", () => {
    expect(isTypeLockedInTopic(lockScoped, "10", "url")).toBe(false);
  });

  it("falls back to the base list for the general thread", () => {
    expect(isTypeLockedInTopic(lockScoped, undefined, "url")).toBe(true);
    expect(isTypeLockedInTopic(lockScoped, undefined, "sticker")).toBe(false);
  });

  it("is case sensitive", () => {
    expect(isTypeLockedInTopic(lockScoped, "10", "Sticker")).toBe(false);
  });
});

describe("parseTopicScopeCommand", () => {
  const inTopic = (
    args: readonly string[],
    topicId: number | undefined = 42,
  ): TelegramUpdateEnvelope =>
    baseUpdate({
      chat: { chatId: 100n, chatType: "supergroup", topicId },
      command: cmd("topicconfig", args),
    });

  it("returns null for other commands or no command", () => {
    expect(
      parseTopicScopeCommand(baseUpdate({ command: cmd("afk") })),
    ).toBeNull();
    expect(parseTopicScopeCommand(baseUpdate())).toBeNull();
  });

  it("parses lock <tipo> with the topic id as string", () => {
    expect(parseTopicScopeCommand(inTopic(["lock", "sticker"]))).toEqual({
      ok: true,
      command: { kind: "lock", topicId: "42", type: "sticker" },
    });
  });

  it("parses unlock <tipo>", () => {
    expect(parseTopicScopeCommand(inTopic(["unlock", "photo"]))).toEqual({
      ok: true,
      command: { kind: "unlock", topicId: "42", type: "photo" },
    });
  });

  it("lowercases the action but preserves the type casing", () => {
    expect(parseTopicScopeCommand(inTopic(["LOCK", "Sticker"]))).toEqual({
      ok: true,
      command: { kind: "lock", topicId: "42", type: "Sticker" },
    });
  });

  it("parses reset and show without a type", () => {
    expect(parseTopicScopeCommand(inTopic(["reset"]))).toEqual({
      ok: true,
      command: { kind: "reset", topicId: "42" },
    });
    expect(parseTopicScopeCommand(inTopic(["show"]))).toEqual({
      ok: true,
      command: { kind: "show", topicId: "42" },
    });
  });

  it("rejects usage outside a topic (general thread)", () => {
    const result = parseTopicScopeCommand(
      baseUpdate({
        chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
        command: cmd("topicconfig", ["show"]),
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "no-topic",
        usage:
          "Uso (dentro de un topic): /topicconfig lock|unlock <tipo> | reset | show",
      },
    });
  });

  it("rejects a missing action", () => {
    const result = parseTopicScopeCommand(inTopic([]));
    expect(result?.ok).toBe(false);
    expect(result && !result.ok && result.error.code).toBe("missing-action");
  });

  it("rejects an unknown action", () => {
    const result = parseTopicScopeCommand(inTopic(["frobnicate"]));
    expect(result?.ok).toBe(false);
    expect(result && !result.ok && result.error.code).toBe("unknown-action");
  });

  it("rejects lock/unlock without a type", () => {
    const lock = parseTopicScopeCommand(inTopic(["lock"]));
    expect(lock?.ok).toBe(false);
    expect(lock && !lock.ok && lock.error.code).toBe("missing-type");

    const unlock = parseTopicScopeCommand(inTopic(["unlock", "   "]));
    expect(unlock?.ok).toBe(false);
    expect(unlock && !unlock.ok && unlock.error.code).toBe("missing-type");
  });

  it("is deterministic for identical inputs", () => {
    const update = inTopic(["lock", "video"]);
    expect(parseTopicScopeCommand(update)).toEqual(
      parseTopicScopeCommand(update),
    );
  });
});

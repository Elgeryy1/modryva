import type { ChatActivityEntry } from "@superbot/data";
import { InMemoryChatSettingRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import type { AiCompleteOptions, AiMessageInput } from "@superbot/module-ai";
import { WEEKLY_RECAP_KEY } from "@superbot/shared";
import type { TelegramGatewayResult } from "@superbot/telegram";
import { describe, expect, it } from "vitest";
import {
  processWeeklyRecap,
  summarizeWeek,
  type WeeklyRecapContext,
  weekKeyFromMs,
} from "./recap-processor.js";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const T0 = 100 * WEEK; // an arbitrary Monday-aligned-ish base
const ok: TelegramGatewayResult = { ok: true, skipped: false };

class FakeGateway {
  sent: Array<{ chatId: bigint; reply: BotReply; token: string | undefined }> =
    [];
  result: TelegramGatewayResult = ok;
  async sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    this.sent.push({
      chatId: input.chatId,
      reply: input.reply,
      token: input.token,
    });
    return this.result;
  }
}

class FakeAi {
  readonly name = "fake";
  calls: AiMessageInput[][] = [];
  constructor(
    private readonly reply: { text: string; degraded?: boolean } | "throw",
  ) {}
  async complete(messages: readonly AiMessageInput[], _o?: AiCompleteOptions) {
    this.calls.push([...messages]);
    if (this.reply === "throw") {
      throw new Error("ai down");
    }
    return {
      text: this.reply.text,
      tokensIn: 1,
      tokensOut: 1,
      provider: "fake",
      ...(this.reply.degraded !== undefined
        ? { degraded: this.reply.degraded }
        : {}),
    };
  }
}

const evt = (username: string, createdAtMs: number): ChatActivityEntry => ({
  telegramUserId: undefined,
  username,
  text: undefined,
  topic: undefined,
  messageId: undefined,
  hasLink: false,
  hasMention: false,
  isReply: false,
  repliedToUserId: undefined,
  tensionScore: undefined,
  createdAt: new Date(createdAtMs),
});

/** `n` in-window events from `username`, spread across the week. */
const many = (username: string, n: number, base = T0): ChatActivityEntry[] =>
  Array.from({ length: n }, (_, i) => evt(username, base + i * (DAY / 4)));

const baseCtx = (
  over: Partial<WeeklyRecapContext> = {},
): WeeklyRecapContext => ({
  chatSetting: new InMemoryChatSettingRepository(),
  gateway: new FakeGateway(),
  ai: new FakeAi({ text: "¡Buena semana!" }),
  resolveBotToken: async () => "tok",
  nowMs: T0,
  listWeekEvents: async () => [],
  resolveChatTelegramId: async () => -1001n,
  ...over,
});

describe("weekKeyFromMs", () => {
  it("advances by exactly one every 7 days", () => {
    expect(weekKeyFromMs(T0 + WEEK) - weekKeyFromMs(T0)).toBe(1);
    expect(weekKeyFromMs(T0 + DAY)).toBe(weekKeyFromMs(T0));
  });
});

describe("summarizeWeek", () => {
  it("counts only the last 7 days and ranks the top posters", () => {
    const events = [
      ...many("ana", 3, T0),
      ...many("luis", 2, T0),
      evt("marta", T0 + DAY),
      evt("old", T0 - 2 * WEEK), // out of window → ignored
    ];
    const s = summarizeWeek(events, T0 + WEEK - 1);
    expect(s.messageCount).toBe(6);
    expect(s.participantCount).toBe(3);
    expect(s.topPosters[0]).toEqual({ name: "@ana", count: 3 });
    expect(s.topPosters[1]).toEqual({ name: "@luis", count: 2 });
    expect(s.busiestDay).not.toBeNull();
  });
});

describe("processWeeklyRecap", () => {
  const enable = async (cs: InMemoryChatSettingRepository) =>
    cs.setValue("t1", "c1", WEEKLY_RECAP_KEY, { enabled: true });

  it("seeds the week silently, then posts once when the week advances", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await enable(chatSetting);
    const ctx = (nowMs: number): WeeklyRecapContext =>
      baseCtx({
        chatSetting,
        gateway,
        nowMs,
        listWeekEvents: async () => many("ana", 10, nowMs - WEEK + DAY),
      });

    const seeded = await processWeeklyRecap(ctx(T0));
    expect(seeded.initialized).toBe(1);
    expect(gateway.sent).toHaveLength(0);

    const posted = await processWeeklyRecap(ctx(T0 + WEEK));
    expect(posted.posted).toBe(1);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.reply.text).toContain("¡Buena semana!");

    // Same week again → no duplicate.
    const repeat = await processWeeklyRecap(ctx(T0 + WEEK));
    expect(repeat.posted).toBe(0);
    expect(gateway.sent).toHaveLength(1);
  });

  it("stays silent when quiet mode is on", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await enable(chatSetting);
    await chatSetting.setValue("t1", "c1", "chat_quiet", { enabled: true });
    const ctx = (nowMs: number): WeeklyRecapContext =>
      baseCtx({
        chatSetting,
        gateway,
        nowMs,
        listWeekEvents: async () => many("ana", 10, nowMs - WEEK + DAY),
      });

    await processWeeklyRecap(ctx(T0)); // seed
    const advanced = await processWeeklyRecap(ctx(T0 + WEEK));
    expect(advanced.posted).toBe(0);
    expect(advanced.skipped).toBe(1);
    expect(gateway.sent).toHaveLength(0);
  });

  it("skips a near-dead week (below the message floor)", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await enable(chatSetting);
    const ctx = (nowMs: number): WeeklyRecapContext =>
      baseCtx({
        chatSetting,
        gateway,
        nowMs,
        listWeekEvents: async () => many("ana", 3, nowMs - WEEK + DAY),
      });

    await processWeeklyRecap(ctx(T0)); // seed
    const advanced = await processWeeklyRecap(ctx(T0 + WEEK));
    expect(advanced.posted).toBe(0);
    expect(gateway.sent).toHaveLength(0);
  });

  it("falls back to the stats card when the AI is unavailable", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await enable(chatSetting);
    const ctx = (nowMs: number): WeeklyRecapContext =>
      baseCtx({
        chatSetting,
        gateway,
        nowMs,
        ai: new FakeAi("throw"),
        listWeekEvents: async () => many("ana", 10, nowMs - WEEK + DAY),
      });

    await processWeeklyRecap(ctx(T0)); // seed
    await processWeeklyRecap(ctx(T0 + WEEK));
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.reply.text).toContain("Resumen de la semana");
    expect(gateway.sent[0]?.reply.parseMode).toBe("Markdown");
  });

  it("posts with the token resolved for the chat's own tenant", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await enable(chatSetting);
    const ctx = (nowMs: number): WeeklyRecapContext =>
      baseCtx({
        chatSetting,
        gateway,
        nowMs,
        resolveBotToken: async (tenantId) => `token-for-${tenantId}`,
        listWeekEvents: async () => many("ana", 10, nowMs - WEEK + DAY),
      });

    await processWeeklyRecap(ctx(T0)); // seed
    await processWeeklyRecap(ctx(T0 + WEEK));
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.token).toBe("token-for-t1");
  });
});

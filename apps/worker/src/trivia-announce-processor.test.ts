import { InMemoryChatSettingRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import { defaultGamesConfig } from "@superbot/shared";
import type { TelegramGatewayResult } from "@superbot/telegram";
import { describe, expect, it } from "vitest";
import {
  processTriviaAnnouncements,
  type TriviaAnnounceContext,
} from "./trivia-announce-processor.js";

const HOUR = 3_600_000;
const ok: TelegramGatewayResult = { ok: true, skipped: false };

class FakeGateway {
  sent: Array<{ chatId: bigint; reply: BotReply }> = [];
  result: TelegramGatewayResult = ok;
  async sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    this.sent.push({ chatId: input.chatId, reply: input.reply });
    return this.result;
  }
}

const baseCtx = (
  over: Partial<TriviaAnnounceContext> = {},
): TriviaAnnounceContext => ({
  chatSetting: new InMemoryChatSettingRepository(),
  gateway: new FakeGateway(),
  token: "tok",
  primaryBotUsername: "ModryvaBot",
  miniAppName: "config",
  appUrlHttps: true,
  nowMs: 1000 * HOUR,
  resolveChatTelegramId: async () => -1001n,
  resolveTenantSlug: async () => "telegram-modryvabot",
  ...over,
});

describe("processTriviaAnnouncements", () => {
  it("does nothing when the app URL is not https", async () => {
    const summary = await processTriviaAnnouncements(
      baseCtx({ appUrlHttps: false }),
    );
    expect(summary.scanned).toBe(0);
  });

  it("seeds the window silently, then announces once per new hourly window", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await chatSetting.setValue("t1", "c1", "games_config", {
      ...defaultGamesConfig("play"),
      triviaCadence: "hourly",
    });
    const at = (hour: number) =>
      baseCtx({ chatSetting, gateway, nowMs: hour * HOUR });

    const seeded = await processTriviaAnnouncements(at(1000));
    expect(seeded.initialized).toBe(1);
    expect(gateway.sent).toHaveLength(0);

    const first = await processTriviaAnnouncements(at(1001));
    expect(first.announced).toBe(1);
    expect(gateway.sent).toHaveLength(1);
    const url = gateway.sent[0]?.reply.replyMarkup as {
      inline_keyboard: Array<Array<{ url: string }>>;
    };
    expect(url.inline_keyboard[0]?.[0]?.url).toContain(
      "startapp=game_dailytrivia_-1001",
    );

    // Same window again → no duplicate.
    const repeat = await processTriviaAnnouncements(at(1001));
    expect(repeat.announced).toBe(0);
    expect(gateway.sent).toHaveLength(1);
  });

  it("skips chats whose purpose does not announce", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await chatSetting.setValue(
      "t1",
      "c1",
      "games_config",
      defaultGamesConfig("moderate"),
    );
    const summary = await processTriviaAnnouncements(
      baseCtx({ chatSetting, gateway }),
    );
    expect(summary.skipped).toBe(1);
    expect(summary.initialized).toBe(0);
    expect(gateway.sent).toHaveLength(0);
  });

  it("skips child-bot tenants (only the primary has a named Mini App)", async () => {
    const gateway = new FakeGateway();
    const chatSetting = new InMemoryChatSettingRepository();
    await chatSetting.setValue(
      "t1",
      "c1",
      "games_config",
      defaultGamesConfig("play"),
    );
    const summary = await processTriviaAnnouncements(
      baseCtx({
        chatSetting,
        gateway,
        resolveTenantSlug: async () => "telegram-childbot",
      }),
    );
    expect(summary.skipped).toBe(1);
    expect(gateway.sent).toHaveLength(0);
  });
});

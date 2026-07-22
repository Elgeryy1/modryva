import type { HttpException } from "@nestjs/common";
import type { ManagedBotChatRecord } from "@superbot/data";
import {
  generateWebhookSecret,
  hashWebhookSecret,
  InMemoryPlatformRepository,
} from "@superbot/data";
import { TELEGRAM_ALLOWED_UPDATES } from "@superbot/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MiniappRequest } from "./miniapp/init-data.guard.js";
import { PlatformController } from "./platform.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

const reqFor = (userId: string): MiniappRequest => ({
  headers: {},
  miniapp: {
    userId,
    user: { id: Number(userId) },
    startParam: null,
    botUsername: "modryvabot",
    botToken: "parent-token",
  },
});

const makeGateway = () => {
  const sent: Array<{
    chatId: bigint;
    token: string | undefined;
    text: string;
  }> = [];
  const chatMetadata = new Map<
    string,
    {
      type?: string;
      title?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  >();
  const chatLookups: bigint[] = [];
  const webhookCalls: Array<{
    token: string | undefined;
    url: string;
    allowedUpdates: readonly string[];
    dropPendingUpdates?: boolean;
  }> = [];
  // What getWebhookInfo reports back; defaults to the real allowed_updates so a
  // refresh verifies. A test can override it to simulate a bot that didn't take.
  let webhookInfoAllowedUpdates: readonly string[] = [
    ...TELEGRAM_ALLOWED_UPDATES,
  ];
  return {
    sent,
    chatMetadata,
    chatLookups,
    webhookCalls,
    setWebhookInfoAllowedUpdates: (updates: readonly string[]) => {
      webhookInfoAllowedUpdates = updates;
    },
    gateway: {
      async setWebhook(input: {
        token: string | undefined;
        url: string;
        secretToken: string;
        allowedUpdates: readonly string[];
        dropPendingUpdates?: boolean;
      }) {
        webhookCalls.push({
          token: input.token,
          url: input.url,
          allowedUpdates: input.allowedUpdates,
          ...(input.dropPendingUpdates !== undefined
            ? { dropPendingUpdates: input.dropPendingUpdates }
            : {}),
        });
        return { ok: true, skipped: false };
      },
      async getWebhookInfo(_input: { token: string | undefined }) {
        return {
          ok: true,
          skipped: false,
          allowedUpdates: webhookInfoAllowedUpdates,
        };
      },
      async sendMessage(input: {
        chatId: bigint;
        token: string | undefined;
        reply: { text: string };
      }) {
        sent.push({
          chatId: input.chatId,
          token: input.token,
          text: input.reply.text,
        });
        return { ok: true, skipped: false };
      },
      async getChat(input: { chatId: bigint; token: string | undefined }) {
        chatLookups.push(input.chatId);
        const metadata = chatMetadata.get(input.chatId.toString());
        return {
          ok: true,
          skipped: false,
          chat: {
            chatId: input.chatId,
            type: metadata?.type ?? "supergroup",
            title: metadata?.title,
            username: metadata?.username,
            firstName: metadata?.firstName,
            lastName: metadata?.lastName,
          },
        };
      },
    },
  };
};

const seedBot = async (
  repo: InMemoryPlatformRepository,
  ownerTelegramId: bigint,
  botTelegramId: bigint,
  username: string,
) => {
  await repo.grantManagedBotSlot({
    ownerTelegramId,
    template: "creator",
    expiresAt: undefined,
    createdByTelegramId: 1n,
  });
  await repo.registerManagedBot({
    ownerTelegramId,
    botTelegramId,
    username,
    displayName: username,
  });
  await repo.activateManagedBot({
    botTelegramId,
    encryptedToken: `${username}-token`,
    tokenFingerprint: "fp",
    webhookSecretHash: hashWebhookSecret(generateWebhookSecret()),
  });
};

describe("PlatformController", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
    process.env.TELEGRAM_BOT_TOKEN = "parent-token";
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = "42";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_USERNAME;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
    delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
  });

  it("lets the platform owner see every managed bot", async () => {
    const repo = new InMemoryPlatformRepository();
    await seedBot(repo, 100n, 700n, "alpha_bot");
    await seedBot(repo, 200n, 800n, "beta_bot");
    const { gateway } = makeGateway();
    const controller = new PlatformController(repo, gateway);

    const me = await controller.me(reqFor("42"));

    expect(me.botScope).toBe("all");
    expect(me.bots.map((bot) => bot.username).sort()).toEqual([
      "alpha_bot",
      "beta_bot",
    ]);
  });

  it("keeps regular bot owners scoped to their own bots", async () => {
    const repo = new InMemoryPlatformRepository();
    await seedBot(repo, 100n, 700n, "alpha_bot");
    await seedBot(repo, 200n, 800n, "beta_bot");
    const { gateway } = makeGateway();
    const controller = new PlatformController(repo, gateway);

    const me = await controller.me(reqFor("100"));

    expect(me.botScope).toBe("owned");
    expect(me.bots.map((bot) => bot.username)).toEqual(["alpha_bot"]);
  });

  it("lets only the platform owner send a message as a managed bot", async () => {
    const repo = new InMemoryPlatformRepository();
    await seedBot(repo, 100n, 700n, "alpha_bot");
    const { gateway, sent } = makeGateway();
    const controller = new PlatformController(repo, gateway);
    Object.assign(controller, {
      foundation: { recordAudit: async () => {} },
    });

    await controller.sendMessageAsBot(reqFor("42"), "alpha_bot", {
      chatId: "-100700",
      text: "hola",
    });

    expect(sent).toEqual([
      { chatId: -100700n, token: "alpha_bot-token", text: "hola" },
    ]);
    await expectHttpErrorAsync(
      controller.sendMessageAsBot(reqFor("100"), "alpha_bot", {
        chatId: "-100700",
        text: "hola",
      }),
      "platform-owner-required",
    );
  });

  it("fills missing group names from Telegram for managed bot chats", async () => {
    const repo = new InMemoryPlatformRepository();
    await seedBot(repo, 100n, 700n, "alpha_bot");
    const chat: ManagedBotChatRecord = {
      chatId: "chat_1",
      telegramChatId: 8571420320n,
      type: "supergroup",
      title: "8571420320",
      username: null,
      memberCount: 1,
      updatedAt: new Date("2026-07-06T10:00:00.000Z"),
    };
    const updates: Array<{
      botUsername: string;
      telegramChatId: bigint;
      title: string | undefined;
    }> = [];
    Object.assign(repo, {
      async listManagedBotChats() {
        return [chat];
      },
      async updateManagedBotChatMetadata(input: {
        botUsername: string;
        telegramChatId: bigint;
        title: string | undefined;
      }) {
        updates.push(input);
      },
    });
    const { gateway, chatMetadata, chatLookups } = makeGateway();
    chatMetadata.set("8571420320", { title: "Grupo STAFF" });
    const controller = new PlatformController(repo, gateway);

    const details = await controller.botDetails(reqFor("42"), "alpha_bot");

    expect(chatLookups).toEqual([8571420320n]);
    expect(details.chats[0]?.title).toBe("Grupo STAFF");
    expect(details.chats[0]?.telegramChatId).toBe("8571420320");
    expect(updates).toMatchObject([
      {
        botUsername: "alpha_bot",
        telegramChatId: 8571420320n,
        title: "Grupo STAFF",
      },
    ]);
  });

  it("uses Telegram private chat names when there is no group title", async () => {
    const repo = new InMemoryPlatformRepository();
    await seedBot(repo, 100n, 700n, "alpha_bot");
    const chat: ManagedBotChatRecord = {
      chatId: "chat_private",
      telegramChatId: 8571420320n,
      type: "private",
      title: null,
      username: null,
      memberCount: 1,
      updatedAt: new Date("2026-07-06T10:00:00.000Z"),
    };
    Object.assign(repo, {
      async listManagedBotChats() {
        return [chat];
      },
    });
    const { gateway, chatMetadata } = makeGateway();
    chatMetadata.set("8571420320", {
      type: "private",
      username: "gerard",
      firstName: "Alex",
      lastName: "Creator",
    });
    const controller = new PlatformController(repo, gateway);

    const details = await controller.botDetails(reqFor("42"), "alpha_bot");

    expect(details.chats[0]?.title).toBe("Alex Creator");
    expect(details.chats[0]?.username).toBe("gerard");
  });

  describe("webhooks/refresh", () => {
    const withAudit = (controller: PlatformController) => {
      Object.assign(controller, {
        foundation: { recordAudit: async () => {} },
      });
      return controller;
    };

    it("refreshes EVERY active bot's webhook with the SSOT allowed_updates, keeps pending updates, and verifies message_reaction", async () => {
      process.env.TELEGRAM_WEBHOOK_BASE_URL = "https://hooks.example";
      const repo = new InMemoryPlatformRepository();
      await seedBot(repo, 100n, 700n, "alpha_bot");
      await seedBot(repo, 200n, 800n, "beta_bot");
      const { gateway, webhookCalls } = makeGateway();
      const controller = withAudit(new PlatformController(repo, gateway));

      const result = await controller.refreshWebhooks(reqFor("42"));

      expect(result).toEqual({
        ok: true,
        total: 2,
        verified: 2,
        skipped: 0,
        failures: [],
      });
      // One real setWebhook per active bot, each carrying the CHILD's own token,
      // the scoped URL, drop_pending_updates=false, and message_reaction.
      expect(webhookCalls).toHaveLength(2);
      for (const call of webhookCalls) {
        expect(call.dropPendingUpdates).toBe(false);
        expect(call.allowedUpdates).toContain("message_reaction");
        expect(call.allowedUpdates).toEqual([...TELEGRAM_ALLOWED_UPDATES]);
      }
      expect(webhookCalls.map((c) => c.token).sort()).toEqual([
        "alpha_bot-token",
        "beta_bot-token",
      ]);
      expect(webhookCalls.map((c) => c.url).sort()).toEqual([
        "https://hooks.example/telegram/webhook/alpha_bot",
        "https://hooks.example/telegram/webhook/beta_bot",
      ]);
    });

    it("counts a bot whose webhook did NOT take (getWebhookInfo lacks message_reaction) as a failure", async () => {
      process.env.TELEGRAM_WEBHOOK_BASE_URL = "https://hooks.example";
      const repo = new InMemoryPlatformRepository();
      await seedBot(repo, 100n, 700n, "alpha_bot");
      const { gateway, setWebhookInfoAllowedUpdates } = makeGateway();
      // Telegram reports the webhook back WITHOUT message_reaction → not verified.
      setWebhookInfoAllowedUpdates(["message", "callback_query"]);
      const controller = withAudit(new PlatformController(repo, gateway));

      const result = await controller.refreshWebhooks(reqFor("42"));

      expect(result).toMatchObject({
        ok: true,
        total: 1,
        verified: 0,
        failures: [
          { username: "alpha_bot", reason: "verify-missing-message_reaction" },
        ],
      });
    });

    it("does nothing and reports not-https when the webhook base URL is not https", async () => {
      // No TELEGRAM_WEBHOOK_BASE_URL set → base falls back to the http default.
      const repo = new InMemoryPlatformRepository();
      await seedBot(repo, 100n, 700n, "alpha_bot");
      const { gateway, webhookCalls } = makeGateway();
      const controller = withAudit(new PlatformController(repo, gateway));

      const result = await controller.refreshWebhooks(reqFor("42"));

      expect(result).toEqual({ ok: false, reason: "webhook-url-not-https" });
      expect(webhookCalls).toHaveLength(0);
    });

    it("refuses a non-owner", async () => {
      process.env.TELEGRAM_WEBHOOK_BASE_URL = "https://hooks.example";
      const repo = new InMemoryPlatformRepository();
      await seedBot(repo, 100n, 700n, "alpha_bot");
      const { gateway, webhookCalls } = makeGateway();
      const controller = withAudit(new PlatformController(repo, gateway));

      await expectHttpErrorAsync(
        controller.refreshWebhooks(reqFor("100")),
        "platform-owner-required",
      );
      expect(webhookCalls).toHaveLength(0);
    });
  });
});

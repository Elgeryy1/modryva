import type {
  CaptchaRepository,
  CaptchaSessionRecord,
  DueSanction,
  DueWarning,
  ExpirationRepository,
  ProductivityRepository,
  ReminderRecord,
  ScheduledPostRecord,
  ScheduledPostRepository,
  TaskRecord,
} from "@superbot/data";
import type { TelegramGatewayResult } from "@superbot/telegram";
import { describe, expect, it } from "vitest";
import {
  type ExpirationGateway,
  processCaptchaExpirations,
  processExpiredManagedBots,
  processReminders,
  processSanctionExpirations,
  processScheduledPosts,
  processWarningExpirations,
} from "./expiration-processor.js";

const ok: TelegramGatewayResult = { ok: true, skipped: false };

class FakeExpirationRepository implements ExpirationRepository {
  expiredSanctions: string[] = [];
  expiredWarnings: string[] = [];

  constructor(
    private readonly sanctions: DueSanction[] = [],
    private readonly warnings: DueWarning[] = [],
  ) {}

  async listDueSanctions(): Promise<DueSanction[]> {
    return this.sanctions;
  }
  async markSanctionExpired(id: string): Promise<void> {
    this.expiredSanctions.push(id);
  }
  async listDueWarnings(): Promise<DueWarning[]> {
    return this.warnings;
  }
  async markWarningExpired(id: string): Promise<void> {
    this.expiredWarnings.push(id);
  }
}

class FakeCaptchaRepository implements CaptchaRepository {
  attempts: { id: string; status: string }[] = [];

  constructor(private readonly pending: CaptchaSessionRecord[] = []) {}

  async getConfig() {
    return null;
  }
  async upsertConfig() {
    return {
      enabled: false,
      mode: "button" as const,
      timeoutSeconds: 120,
      maxAttempts: 3,
      failAction: "ban" as const,
    };
  }
  async createSession(): Promise<CaptchaSessionRecord> {
    throw new Error("not used");
  }
  async findPendingSession() {
    return null;
  }
  async recordAttempt(id: string, status: string) {
    this.attempts.push({ id, status });
    return { ...this.pending[0], id, status } as CaptchaSessionRecord;
  }
  async listExpiredPending(): Promise<CaptchaSessionRecord[]> {
    return this.pending;
  }
}

class FakeGateway implements ExpirationGateway {
  unbans = 0;
  lifts = 0;
  bans = 0;
  restrictions = 0;

  async unbanChatMember() {
    this.unbans += 1;
    return ok;
  }
  async liftRestrictions() {
    this.lifts += 1;
    return ok;
  }
  async banChatMember() {
    this.bans += 1;
    return ok;
  }
  async restrictChatMember() {
    this.restrictions += 1;
    return ok;
  }
}

describe("processSanctionExpirations", () => {
  it("unbans expired bans and lifts expired mutes, then marks them expired", async () => {
    const expirations = new FakeExpirationRepository([
      {
        id: "s1",
        tenantId: "t",
        kind: "ban",
        telegramUserId: 10n,
        telegramChatId: -100n,
      },
      {
        id: "s2",
        tenantId: "t",
        kind: "mute",
        telegramUserId: 11n,
        telegramChatId: -100n,
      },
    ]);
    const gateway = new FakeGateway();

    const summary = await processSanctionExpirations({
      expirations,
      captcha: new FakeCaptchaRepository(),
      gateway,
      token: "secret",
      now: new Date("2026-06-28T00:00:00.000Z"),
      resolveBotToken: async () => "secret",
    });

    expect(gateway.unbans).toBe(1);
    expect(gateway.lifts).toBe(1);
    expect(summary).toEqual({ processed: 2, reverted: 2, errors: 0 });
    expect(expirations.expiredSanctions).toEqual(["s1", "s2"]);
  });

  it("still marks the sanction expired when Telegram ids are missing", async () => {
    const expirations = new FakeExpirationRepository([
      {
        id: "s3",
        tenantId: "t",
        kind: "mute",
        telegramUserId: undefined,
        telegramChatId: undefined,
      },
    ]);
    const gateway = new FakeGateway();

    const summary = await processSanctionExpirations({
      expirations,
      captcha: new FakeCaptchaRepository(),
      gateway,
      token: "secret",
      now: new Date(),
      resolveBotToken: async () => "secret",
    });

    expect(gateway.lifts).toBe(0);
    expect(summary.processed).toBe(1);
    expect(expirations.expiredSanctions).toEqual(["s3"]);
  });
});

describe("processCaptchaExpirations", () => {
  it("expires sessions and applies the fail action", async () => {
    const session: CaptchaSessionRecord = {
      id: "c1",
      tenantId: "t",
      chatId: "chat_1",
      telegramUserId: 20n,
      answerHash: "hash",
      answerSalt: "salt",
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      failAction: "ban",
      expiresAt: new Date("2026-06-28T00:00:00.000Z"),
    };
    const captcha = new FakeCaptchaRepository([session]);
    const gateway = new FakeGateway();

    const summary = await processCaptchaExpirations({
      expirations: new FakeExpirationRepository(),
      captcha,
      gateway,
      token: "secret",
      now: new Date("2026-06-28T01:00:00.000Z"),
      resolveChatTelegramId: async () => -100n,
      resolveBotToken: async () => "secret",
    });

    expect(captcha.attempts).toEqual([{ id: "c1", status: "expired" }]);
    expect(gateway.bans).toBe(1);
    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
  });
});

class FakeScheduledPostRepository implements ScheduledPostRepository {
  sent: string[] = [];
  failed: string[] = [];

  constructor(private readonly due: ScheduledPostRecord[] = []) {}

  async create(): Promise<ScheduledPostRecord> {
    throw new Error("not used");
  }
  async listPending(): Promise<ScheduledPostRecord[]> {
    return [];
  }
  async listDue(): Promise<ScheduledPostRecord[]> {
    return this.due;
  }
  async markSent(id: string): Promise<void> {
    this.sent.push(id);
  }
  async markFailed(id: string): Promise<void> {
    this.failed.push(id);
  }
  async cancel(): Promise<boolean> {
    return false;
  }
  async toggleReaction(): Promise<Record<string, number>> {
    return {};
  }
  async countReactions(): Promise<Record<string, number>> {
    return {};
  }
}

describe("processScheduledPosts", () => {
  it("publishes due posts and marks them sent", async () => {
    const posts = new FakeScheduledPostRepository([
      {
        id: "sp1",
        tenantId: "t",
        telegramChatId: -100n,
        text: "hola",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
    ]);
    let sentText: string | undefined;
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        sentText = input.reply.text;
        return ok;
      },
    };

    const summary = await processScheduledPosts({
      posts,
      gateway,
      resolveBotToken: async () => "secret",
      now: new Date("2026-06-28T01:00:00.000Z"),
    });

    expect(sentText).toBe("hola");
    expect(posts.sent).toEqual(["sp1"]);
    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
  });

  it("sends each post with its own tenant's resolved bot token", async () => {
    const posts = new FakeScheduledPostRepository([
      {
        id: "sp1",
        tenantId: "t1",
        telegramChatId: -100n,
        text: "hola t1",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
      {
        id: "sp2",
        tenantId: "t2",
        telegramChatId: -200n,
        text: "hola t2",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
    ]);
    const tokensUsed: Array<string | undefined> = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        tokensUsed.push(input.token);
        return ok;
      },
    };
    const tokensByTenant: Record<string, string> = {
      t1: "token-t1",
      t2: "token-t2",
    };

    await processScheduledPosts({
      posts,
      gateway,
      resolveBotToken: async (tenantId) => tokensByTenant[tenantId],
      now: new Date("2026-06-28T01:00:00.000Z"),
    });

    expect(tokensUsed).toEqual(["token-t1", "token-t2"]);
  });
});

class FakeProductivityRepository implements ProductivityRepository {
  fired: string[] = [];

  constructor(private readonly due: ReminderRecord[] = []) {}

  async createReminder(): Promise<ReminderRecord> {
    throw new Error("not used");
  }
  async listPendingReminders(): Promise<ReminderRecord[]> {
    return [];
  }
  async listDueReminders(): Promise<ReminderRecord[]> {
    return this.due;
  }
  async markReminderFired(id: string): Promise<void> {
    this.fired.push(id);
  }
  async cancelReminder(): Promise<boolean> {
    return false;
  }
  async createTask(): Promise<TaskRecord> {
    throw new Error("not used");
  }
  async listTasks(): Promise<TaskRecord[]> {
    return [];
  }
  async completeTask(): Promise<boolean> {
    return false;
  }
  async setAfk(): Promise<void> {}
  async clearAfk(): Promise<null> {
    return null;
  }
  async findAfk(): Promise<null> {
    return null;
  }
  async findAfkByUsernames(): Promise<never[]> {
    return [];
  }
}

describe("processReminders", () => {
  it("delivers due reminders and marks them fired", async () => {
    const productivity = new FakeProductivityRepository([
      {
        id: "rm1",
        tenantId: "t",
        telegramChatId: -100n,
        text: "Llamar",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
    ]);
    let sentText: string | undefined;
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        sentText = input.reply.text;
        return ok;
      },
    };

    const summary = await processReminders({
      productivity,
      gateway,
      resolveBotToken: async () => "secret",
      now: new Date("2026-06-28T01:00:00.000Z"),
    });

    expect(sentText).toContain("Llamar");
    expect(productivity.fired).toEqual(["rm1"]);
    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
  });

  it("delivers each reminder with its own tenant's resolved bot token", async () => {
    const productivity = new FakeProductivityRepository([
      {
        id: "rm1",
        tenantId: "t1",
        telegramChatId: -100n,
        text: "Llamar",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
      {
        id: "rm2",
        tenantId: "t2",
        telegramChatId: -200n,
        text: "Escribir",
        runAt: new Date("2026-06-28T00:00:00.000Z"),
      },
    ]);
    const tokensUsed: Array<string | undefined> = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        tokensUsed.push(input.token);
        return ok;
      },
    };
    const tokensByTenant: Record<string, string> = {
      t1: "token-t1",
      t2: "token-t2",
    };

    await processReminders({
      productivity,
      gateway,
      resolveBotToken: async (tenantId) => tokensByTenant[tenantId],
      now: new Date("2026-06-28T01:00:00.000Z"),
    });

    expect(tokensUsed).toEqual(["token-t1", "token-t2"]);
  });
});

describe("processWarningExpirations", () => {
  it("marks due warnings as expired", async () => {
    const expirations = new FakeExpirationRepository(
      [],
      [{ id: "w1", tenantId: "t", userId: "u1" }],
    );

    const summary = await processWarningExpirations({
      expirations,
      captcha: new FakeCaptchaRepository(),
      gateway: new FakeGateway(),
      token: undefined,
      now: new Date(),
      resolveBotToken: async () => undefined,
    });

    expect(expirations.expiredWarnings).toEqual(["w1"]);
    expect(summary.processed).toBe(1);
  });
});

describe("processExpiredManagedBots", () => {
  const noWarnings = {
    async listBotsExpiringSoon() {
      return [];
    },
    async markExpiryWarned() {},
  };

  it("removes the webhook, suspends the bot and DMs the owner", async () => {
    const suspended: string[] = [];
    const deleted: (string | undefined)[] = [];
    const dms: bigint[] = [];
    const summary = await processExpiredManagedBots({
      platform: {
        ...noWarnings,
        async listExpiredActiveBots() {
          return [
            {
              id: "b1",
              username: "childbot",
              ownerTelegramId: 99n,
              expiresAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ];
        },
        async getManagedBotToken(username: string) {
          return `token-${username}`;
        },
        async suspendManagedBot(id: string) {
          suspended.push(id);
        },
      },
      gateway: {
        async deleteWebhook({ token }) {
          deleted.push(token);
          return ok;
        },
        async sendMessage({ chatId }) {
          dms.push(chatId);
          return ok;
        },
      },
      parentToken: "parent",
      warnWithinMs: 0,
      now: new Date(),
    });

    expect(summary.processed).toBe(1);
    expect(deleted).toEqual(["token-childbot"]);
    expect(suspended).toEqual(["b1"]);
    expect(dms).toEqual([99n]);
  });

  it("warns owners about an upcoming expiry (once)", async () => {
    const warned: string[] = [];
    const dms: bigint[] = [];
    const summary = await processExpiredManagedBots({
      platform: {
        async listExpiredActiveBots() {
          return [];
        },
        async getManagedBotToken() {
          return undefined;
        },
        async suspendManagedBot() {},
        async listBotsExpiringSoon() {
          return [
            {
              id: "b3",
              username: "soonbot",
              ownerTelegramId: 77n,
              expiresAt: new Date("2026-07-06T00:00:00.000Z"),
            },
          ];
        },
        async markExpiryWarned(id: string) {
          warned.push(id);
        },
      },
      gateway: {
        async deleteWebhook() {
          return ok;
        },
        async sendMessage({ chatId }) {
          dms.push(chatId);
          return ok;
        },
      },
      parentToken: "parent",
      warnWithinMs: 3 * 24 * 60 * 60 * 1000,
      now: new Date(),
    });

    expect(summary.processed).toBe(1);
    expect(dms).toEqual([77n]);
    expect(warned).toEqual(["b3"]);
  });
});

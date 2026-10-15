import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  type ActivityWindowRow,
  type AntifloodConfigState,
  type AntifloodConfigUpdate,
  type CaptchaConfigState,
  type CaptchaConfigUpdate,
  InMemoryD1Repository,
  InMemoryFederationRepository,
  type TopPosterRow,
  type WelcomeConfigState,
  type WelcomeConfigUpdate,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappNetworkAnalyticsController } from "./network-analytics.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeAnalytics {
  private readonly recent = new Map<string, ActivityWindowRow[]>();
  private readonly totals = new Map<string, number>();
  private readonly posters = new Map<string, TopPosterRow[]>();
  private readonly activeCounts = new Map<string, number>();

  seed(
    chatId: string,
    data: {
      recent?: ActivityWindowRow[];
      total?: number;
      posters?: TopPosterRow[];
      active?: number;
    },
  ) {
    if (data.recent) this.recent.set(chatId, data.recent);
    if (data.total !== undefined) this.totals.set(chatId, data.total);
    if (data.posters) this.posters.set(chatId, data.posters);
    if (data.active !== undefined) this.activeCounts.set(chatId, data.active);
  }

  async getRecentDays(chatId: string): Promise<ActivityWindowRow[]> {
    return this.recent.get(chatId) ?? [];
  }

  async getTotal(chatId: string): Promise<number> {
    return this.totals.get(chatId) ?? 0;
  }

  async getTopPosters(chatId: string): Promise<TopPosterRow[]> {
    return this.posters.get(chatId) ?? [];
  }

  async getActiveUserCount(chatId: string): Promise<number> {
    return this.activeCounts.get(chatId) ?? 0;
  }
}

class FakeCaptcha {
  private readonly configs = new Map<string, CaptchaConfigState>();
  async getConfig(
    _tenantId: string,
    chatId: string,
  ): Promise<CaptchaConfigState | null> {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: CaptchaConfigUpdate,
  ): Promise<CaptchaConfigState> {
    const next: CaptchaConfigState = {
      enabled: update.enabled ?? false,
      mode: update.mode ?? "button",
      timeoutSeconds: update.timeoutSeconds ?? 120,
      maxAttempts: update.maxAttempts ?? 3,
      failAction: update.failAction ?? "mute",
    };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeAntiflood {
  private readonly configs = new Map<string, AntifloodConfigState>();
  async getConfig(
    _tenantId: string,
    chatId: string,
  ): Promise<AntifloodConfigState | null> {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: AntifloodConfigUpdate,
  ): Promise<AntifloodConfigState> {
    const next: AntifloodConfigState = {
      enabled: update.enabled ?? false,
      windowSeconds: update.windowSeconds ?? 10,
      messageLimit: update.messageLimit ?? 8,
      action: update.action ?? "mute",
      muteSeconds: update.muteSeconds ?? 300,
      cooldownSeconds: update.cooldownSeconds ?? 60,
    };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeWelcome {
  private readonly configs = new Map<string, WelcomeConfigState>();
  seed(chatId: string, config: WelcomeConfigState) {
    this.configs.set(chatId, config);
  }
  async getConfig(chatId: string): Promise<WelcomeConfigState | null> {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: WelcomeConfigUpdate,
  ): Promise<WelcomeConfigState> {
    const current = this.configs.get(chatId) ?? {
      welcomeText: null,
      goodbyeText: null,
      rulesText: null,
      welcomeMediaType: null,
      welcomeButtons: null,
    };
    const next = { ...current, ...update };
    this.configs.set(chatId, next);
    return next;
  }
}

const makeController = (
  adminOverrides: Partial<MiniappAdminService> = {},
  chatId = "c1",
) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId,
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappNetworkAnalyticsController(admin);
  const federation = new InMemoryFederationRepository();
  const analytics = new FakeAnalytics();
  const captcha = new FakeCaptcha();
  const antiflood = new FakeAntiflood();
  const welcome = new FakeWelcome();
  const d1 = new InMemoryD1Repository();

  Object.assign(controller, {
    federation,
    analytics,
    captcha,
    antiflood,
    welcome,
    d1,
  });

  return { controller, federation, analytics, captcha, antiflood, welcome, d1 };
};

const reqWith = (miniapp: MiniappRequest["miniapp"]): MiniappRequest => ({
  headers: {},
  ...(miniapp ? { miniapp } : {}),
});

const ctxFor = (userId: string) => ({
  userId,
  user: { id: Number(userId) },
  startParam: null,
  botUsername: "modryvabot",
  botToken: "123456:test-token",
});

describe("MiniappNetworkAnalyticsController", () => {
  it("computes the health score as a weighted average across the network", async () => {
    const { controller, federation, captcha, antiflood, welcome, d1 } =
      makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);

    await captcha.upsertConfig("t1", "c1", { enabled: true });
    await antiflood.upsertConfig("t1", "c1", { enabled: true });
    await welcome.upsertConfig("t1", "c1", { welcomeText: "Hola" });
    await d1.setLogChannel("t1", "c1", -500n);

    const result = await controller.analyticsView(
      reqWith(ctxFor("42")),
      "-100",
    );
    expect(result.healthScore).toBe(50);
  });

  it("detects groups missing captcha, antiflood or welcome", async () => {
    const { controller, federation, captcha, antiflood, welcome } =
      makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);
    await captcha.upsertConfig("t1", "c1", { enabled: true });
    await antiflood.upsertConfig("t1", "c1", { enabled: true });
    await welcome.upsertConfig("t1", "c1", { welcomeText: "Hola" });

    const result = await controller.analyticsView(
      reqWith(ctxFor("42")),
      "-100",
    );
    expect(result.unconfiguredChats).toHaveLength(1);
    expect(result.unconfiguredChats[0]).toMatchObject({
      chatId: "c2",
      missingCaptcha: true,
      missingAntiflood: true,
      missingWelcome: true,
    });
  });

  it("applies the enable-captcha doctor fix to affected chats", async () => {
    const { controller, federation, captcha } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);

    await controller.applyFix(reqWith(ctxFor("42")), "-100", {
      recommendationId: "enable-captcha",
    });

    const fixed = await captcha.getConfig("t1", "c2");
    expect(fixed?.enabled).toBe(true);
  });

  it("rejects a recommendation without a defined auto-fix", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);

    await expectHttpErrorAsync(
      controller.applyFix(reqWith(ctxFor("42")), "-100", {
        recommendationId: "configure-welcome",
      }),
      "no-auto-fix",
    );
  });

  it("blocks a non network-admin from reading network analytics", async () => {
    const { federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);

    const { controller: memberController } = makeController(
      {
        assertGroupAdmin: async () => {},
        resolveChat: async (gid: string) => ({
          tenantId: "t1",
          chatId: "c2",
          telegramChatId: gid,
          title: "Grupo 2",
        }),
      },
      "c2",
    );
    Object.assign(memberController, { federation });

    await expectHttpErrorAsync(
      memberController.analyticsView(reqWith(ctxFor("99")), "-200"),
      "not-network-admin",
    );
  });

  it("rejects reading analytics when the user is not a group admin at all", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.analyticsView(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("falls back to the single chat when the group is not in a network", async () => {
    const { controller } = makeController();
    const result = await controller.analyticsView(
      reqWith(ctxFor("42")),
      "-100",
    );
    expect(result.chatCount).toBe(1);
  });
});

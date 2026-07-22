import crypto from "node:crypto";
import { ForbiddenException, type HttpException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Nest HttpException(.message) is the generic name; the {error} payload lives in
// getResponse(). This helper asserts on the payload code.
const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

import { SECTION_NAMES } from "@superbot/shared";
import type { MiniappAdminService } from "./admin.service.js";
import { MiniappConfigController } from "./config.controller.js";
import { InitDataGuard, type MiniappRequest } from "./init-data.guard.js";

const botToken = "123456:test-token";

const signInitData = (raw: Record<string, string>, token: string) => {
  const dataCheckString = Object.entries(raw)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  const hash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  return new URLSearchParams({ ...raw, hash }).toString();
};

const contextFor = (headers: Record<string, string | undefined>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    // biome-ignore lint/suspicious/noExplicitAny: minimal ExecutionContext mock
  }) as any;

const fakePlatform = (
  overrides: Partial<{
    getActivePlatformUserBan: (userId: bigint) => Promise<unknown>;
    getManagedBotToken: (username: string) => Promise<string | undefined>;
    hasRole: (userId: bigint, role: string) => Promise<boolean>;
  }> = {},
) => ({
  getActivePlatformUserBan: async () => null,
  getManagedBotToken: async () => undefined,
  hasRole: async () => false,
  ...overrides,
});

describe("InitDataGuard", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = botToken;
    process.env.INITDATA_MAX_AGE_SECONDS = "3600";
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.INITDATA_MAX_AGE_SECONDS;
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });

  beforeEach(() => {
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  const guard = new InitDataGuard();

  beforeEach(() => {
    Object.assign(guard, { platformRepo: fakePlatform() });
  });

  it("rejects a request without Authorization", async () => {
    await expectHttpErrorAsync(
      guard.canActivate(contextFor({})),
      "missing-auth",
    );
  });

  it("rejects tampered initData", async () => {
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: '{"id":1}' },
      botToken,
    );
    await expectHttpErrorAsync(
      guard.canActivate(contextFor({ authorization: `tma ${initData}&x=1` })),
      "invalid-hash",
    );
  });

  it("rejects stale initData", async () => {
    const old = Math.floor(Date.now() / 1000) - 7200;
    const initData = signInitData(
      { auth_date: String(old), user: '{"id":1}' },
      botToken,
    );
    await expectHttpErrorAsync(
      guard.canActivate(contextFor({ authorization: `tma ${initData}` })),
      "auth-date-expired",
    );
  });

  it("accepts fresh initData and attaches the parent-bot context", async () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      {
        auth_date: String(now),
        user: '{"id":42,"username":"g"}',
        start_param: "cfg_-100",
      },
      botToken,
    );
    const req: MiniappRequest = {
      headers: { authorization: `tma ${initData}` },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    } as any;
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.miniapp?.userId).toBe("42");
    expect(req.miniapp?.startParam).toBe("cfg_-100");
    // No X-Bot-Username → primary bot resolved from the environment.
    expect(req.miniapp?.botUsername).toBe("modryvabot");
    expect(req.miniapp?.botToken).toBe(botToken);
  });

  it("rejects Mini App access for globally banned platform users", async () => {
    const g = new InitDataGuard();
    Object.assign(g, {
      platformRepo: fakePlatform({
        getActivePlatformUserBan: async (userId: bigint) =>
          userId === 666n
            ? {
                telegramUserId: 666n,
                reason: "spam",
                bannedByTelegramId: 42n,
                bannedAt: new Date("2026-07-06T10:00:00.000Z"),
                expiresAt: new Date("2026-07-07T10:00:00.000Z"),
                revokedAt: null,
              }
            : null,
      }),
    });
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":666}' },
      botToken,
    );

    try {
      await g.canActivate(contextFor({ authorization: `tma ${initData}` }));
    } catch (error) {
      expect((error as HttpException).getResponse()).toMatchObject({
        error: "platform-user-banned",
        reason: "spam",
        bannedAt: "2026-07-06T10:00:00.000Z",
        expiresAt: "2026-07-07T10:00:00.000Z",
      });
      return;
    }
    throw new Error("expected platform-user-banned");
  });

  it("rejects a malformed X-Bot-Username hint", async () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":1}' },
      botToken,
    );
    await expectHttpErrorAsync(
      guard.canActivate(
        contextFor({
          authorization: `tma ${initData}`,
          "x-bot-username": "no spaces!",
        }),
      ),
      "invalid-bot",
    );
  });

  it("ignores an X-Bot-Username that equals the primary bot", async () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":7}' },
      botToken,
    );
    const req: MiniappRequest = {
      headers: {
        authorization: `tma ${initData}`,
        "x-bot-username": "@ModryvaBot",
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    } as any;
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.miniapp?.botUsername).toBe("modryvabot");
    expect(req.miniapp?.botToken).toBe(botToken);
  });

  it("lets the configured platform owner act as a child bot from a parent session", async () => {
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = "42";
    const g = new InitDataGuard();
    Object.assign(g, {
      platformRepo: fakePlatform({
        getManagedBotToken: async (username: string) =>
          username === "childbot" ? "child-token" : undefined,
      }),
    });
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":42}' },
      botToken,
    );
    const req: MiniappRequest = {
      headers: {
        authorization: `tma ${initData}`,
        "x-platform-act-as-bot-username": "childbot",
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    } as any;

    expect(await g.canActivate(ctx)).toBe(true);
    expect(req.miniapp?.botUsername).toBe("childbot");
    expect(req.miniapp?.botToken).toBe("child-token");
    expect(req.miniapp?.platformActAs?.sourceBotUsername).toBe("modryvabot");
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });

  it("rejects platform act-as for non-owners", async () => {
    const g = new InitDataGuard();
    Object.assign(g, {
      platformRepo: fakePlatform({
        hasRole: async () => false,
      }),
    });
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":42}' },
      botToken,
    );
    await expectHttpErrorAsync(
      g.canActivate(
        contextFor({
          authorization: `tma ${initData}`,
          "x-platform-act-as-bot-username": "childbot",
        }),
      ),
      "platform-owner-required",
    );
  });

  it("rejects platform act-as when the request is signed as another child bot", async () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      { auth_date: String(now), user: '{"id":42}' },
      botToken,
    );
    await expectHttpErrorAsync(
      guard.canActivate(
        contextFor({
          authorization: `tma ${initData}`,
          "x-bot-username": "otherchild",
          "x-platform-act-as-bot-username": "childbot",
        }),
      ),
      "act-as-requires-primary-session",
    );
  });

  it("rejects a well-formed but unknown child bot with 401", async () => {
    const g = new InitDataGuard();
    Object.assign(g, {
      platformRepo: fakePlatform({ getManagedBotToken: async () => undefined }),
    });
    await expectHttpErrorAsync(
      g.canActivate(
        contextFor({
          authorization: "tma anything",
          "x-bot-username": "ghostchildbot",
        }),
      ),
      "unknown-bot",
    );
  });

  it("returns 503 (not a negative-cache) when the token store errors", async () => {
    const g = new InitDataGuard();
    Object.assign(g, {
      platformRepo: fakePlatform({
        getManagedBotToken: async () => {
          throw new Error("db-down");
        },
      }),
    });
    await expectHttpErrorAsync(
      g.canActivate(
        contextFor({
          authorization: "tma anything",
          "x-bot-username": "flakychildbot",
        }),
      ),
      "bot-token-unavailable",
    );
  });
});

class FakeWelcome {
  config: Record<string, unknown> = {};
  async getConfig() {
    return {
      welcomeText: this.config.welcomeText ?? null,
      goodbyeText: this.config.goodbyeText ?? null,
      rulesText: this.config.rulesText ?? null,
    };
  }
  async upsertConfig(_t: string, _c: string, patch: Record<string, unknown>) {
    this.config = { ...this.config, ...patch };
    return this.config;
  }
}
class FakeFlood {
  saved: Record<string, unknown> | null = null;
  async getConfig() {
    return null;
  }
  async upsertConfig(_t: string, _c: string, patch: Record<string, unknown>) {
    this.saved = patch;
    return patch;
  }
}
class FakeLocks {
  async getLocked() {
    return [];
  }
  async setLocked() {
    return [];
  }
}
class FakeCaptcha {
  async getConfig() {
    return null;
  }
  async upsertConfig() {
    return null;
  }
}
class FakeAntiraid {
  config: Record<string, unknown> | null = null;
  async getConfig() {
    return this.config;
  }
  async upsertConfig(_t: string, _c: string, update: Record<string, unknown>) {
    this.config = { ...(this.config ?? {}), ...update };
    return this.config;
  }
}
class FakeChatSetting {
  store = new Map<string, unknown>();
  async getValue(_t: string, _c: string, key: string) {
    return this.store.get(key) ?? null;
  }
  async setValue(_t: string, _c: string, key: string, value: unknown) {
    this.store.set(key, value);
  }
}

class FakeWarns {
  readonly policies = new Map<string, Record<string, unknown>>();
  async getWarnPolicy(chatId: string) {
    return (
      this.policies.get(chatId) ?? {
        warnLimit: 3,
        warnMode: "mute",
        durationMs: null,
        expireMs: null,
      }
    );
  }
  async setWarnPolicy(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const current = (await this.getWarnPolicy(chatId)) as Record<
      string,
      unknown
    >;
    const next = { ...current, ...patch };
    this.policies.set(chatId, next);
    return next;
  }
}

const defaultHygiene = {
  cleanService: false,
  cleanWelcome: false,
  nightMode: false,
  nightStart: 23,
  nightEnd: 7,
  welcomeMute: false,
  autoApprove: false,
  rtlFilter: false,
  cjkFilter: false,
  language: "es",
  blockKnownSpammers: false,
};

class FakeHygiene {
  readonly hygiene = new Map<string, Record<string, unknown>>();
  readonly gates = new Map<string, bigint | null>();
  async getHygiene(chatId: string) {
    return this.hygiene.get(chatId) ?? { ...defaultHygiene };
  }
  async setHygiene(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const current = this.hygiene.get(chatId) ?? { ...defaultHygiene };
    const next = { ...current, ...patch };
    this.hygiene.set(chatId, next);
    return next;
  }
  async getMembershipGate(chatId: string) {
    const value = this.gates.get(chatId);
    return value ? { requiredTelegramChatId: value } : null;
  }
  async setMembershipGate(
    _tenantId: string,
    chatId: string,
    _telegramChatId: bigint,
    requiredTelegramChatId: bigint | null,
  ) {
    this.gates.set(chatId, requiredTelegramChatId);
    return requiredTelegramChatId ? { requiredTelegramChatId } : null;
  }
}

const makeController = (adminOverrides: Partial<MiniappAdminService> = {}) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappConfigController(admin);
  const welcome = new FakeWelcome();
  const flood = new FakeFlood();
  const locks = new FakeLocks();
  const captcha = new FakeCaptcha();
  const antiraid = new FakeAntiraid();
  const chatSetting = new FakeChatSetting();
  const warns = new FakeWarns();
  const hygiene = new FakeHygiene();
  const audits: unknown[] = [];
  Object.assign(controller, {
    welcome,
    flood,
    locks,
    captcha,
    antiraid,
    chatSetting,
    warns,
    hygiene,
    foundation: { recordAudit: async (i: unknown) => void audits.push(i) },
  });
  return {
    controller,
    welcome,
    flood,
    antiraid,
    chatSetting,
    warns,
    hygiene,
    audits,
  };
};

const reqWith = (miniapp: MiniappRequest["miniapp"]): MiniappRequest => ({
  headers: {},
  ...(miniapp ? { miniapp } : {}),
});
const CTX = {
  userId: "42",
  user: { id: 42 },
  startParam: null,
  botUsername: "modryvabot",
  botToken: "123456:test-token",
};

describe("MiniappConfigController", () => {
  it("returns a string telegramChatId in the snapshot", async () => {
    const { controller } = makeController();
    const snap = await controller.snapshot(reqWith(CTX), "-1001234567890");
    expect(typeof snap.telegramChatId).toBe("string");
    expect(snap.sections.flood).toBeTruthy();
  });

  it("returns all 10 sections in the snapshot, not a hand-picked subset", async () => {
    const { controller } = makeController();
    const snap = await controller.snapshot(reqWith(CTX), "-1001234567890");
    expect(Object.keys(snap.sections).sort()).toEqual(
      [...SECTION_NAMES].sort(),
    );
  });

  it("clamps the flood message limit and writes an audit on PUT", async () => {
    const { controller, flood, audits } = makeController();
    await controller.update(reqWith(CTX), "-100", "flood", {
      enabled: true,
      messageLimit: 99,
      windowSeconds: 10,
      action: "mute",
    });
    expect(flood.saved?.messageLimit).toBe(20); // clamped from 99
    expect(audits).toHaveLength(1);
  });

  it("rejects an unknown section", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.update(reqWith(CTX), "-100", "wormhole", {}),
      "unknown-section",
    );
  });

  it("rejects an invalid body", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.update(reqWith(CTX), "-100", "flood", {
        enabled: true,
        messageLimit: 5,
        windowSeconds: 10,
        action: "nope",
      }),
      "invalid-body",
    );
  });

  it("propagates a 403 when the user is not an admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.snapshot(reqWith(CTX), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("session surfaces whether the serving bot is a group admin", async () => {
    const { controller } = makeController({
      botDisplayName: async () => "Modryva",
      botIdentity: async () => ({ template: null, isPrimary: true }),
      isBotAdmin: async () => false,
    });
    const res = await controller.session(reqWith(CTX), {
      startParam: "cfg_-100",
    });
    expect(res.group).toMatchObject({
      telegramChatId: "-100",
      botIsAdmin: false,
    });
  });

  it("raid section defaults to disabled, then persists via PUT", async () => {
    const { controller } = makeController();
    const before = await controller.section(reqWith(CTX), "-100", "raid");
    expect(before).toMatchObject({ enabled: false, mode: "observe" });
    const saved = await controller.update(reqWith(CTX), "-100", "raid", {
      enabled: true,
      mode: "enforce",
      joinLimit: 8,
      windowSeconds: 45,
      newAccountAgeDays: 3,
    });
    expect(saved).toMatchObject({
      enabled: true,
      mode: "enforce",
      joinLimit: 8,
    });
  });

  it("stores and reads schedule rules round-trip", async () => {
    const { controller } = makeController();
    const put = await controller.updateScheduleRules(reqWith(CTX), "-100", {
      rules: [{ startHour: 22, endHour: 6, strict: true }],
    });
    expect(put.rules).toHaveLength(1);
    const got = await controller.scheduleRules(reqWith(CTX), "-100");
    expect(got.rules[0]).toMatchObject({ startHour: 22, strict: true });
  });

  it("rejects invalid schedule rules", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.updateScheduleRules(reqWith(CTX), "-100", {
        rules: [{ startHour: 99, endHour: 6, strict: true }],
      }),
      "invalid-body",
    );
  });

  it("stores and reads rituals round-trip", async () => {
    const { controller } = makeController();
    await controller.updateRituals(reqWith(CTX), "-100", {
      rituals: [{ weekday: 1, hour: 9, message: "Buenos días" }],
    });
    const got = await controller.rituals(reqWith(CTX), "-100");
    expect(got.rituals[0]).toMatchObject({
      weekday: 1,
      message: "Buenos días",
    });
  });

  it("quiet mode defaults to off and round-trips", async () => {
    const { controller } = makeController();
    expect((await controller.quiet(reqWith(CTX), "-100")).enabled).toBe(false);
    const put = await controller.updateQuiet(reqWith(CTX), "-100", {
      enabled: true,
    });
    expect(put.enabled).toBe(true);
    expect((await controller.quiet(reqWith(CTX), "-100")).enabled).toBe(true);
  });

  it("reaction moderation defaults to off and round-trips with an audit", async () => {
    const { controller, audits } = makeController();
    const before = await controller.reactions(reqWith(CTX), "-100");
    expect(before.config.mode).toBe("off");

    const put = await controller.updateReactions(reqWith(CTX), "-100", {
      mode: "enforce",
      blockedEmojis: ["🖕"],
      blockedCustomEmojiIds: ["nasty"],
      surgeThreshold: 20,
      surgeWindowSeconds: 45,
    });
    expect(put.config).toMatchObject({
      mode: "enforce",
      blockedEmojis: ["🖕"],
      surgeThreshold: 20,
    });
    const got = await controller.reactions(reqWith(CTX), "-100");
    expect(got.config.mode).toBe("enforce");
    expect(audits).toHaveLength(1);
  });

  it("sanitizes a hostile reactions body (bad mode, over-limit threshold, dupes)", async () => {
    const { controller } = makeController();
    const put = await controller.updateReactions(reqWith(CTX), "-100", {
      mode: "turbo",
      blockedEmojis: [" 🖕 ", "🖕", 7, ""],
      surgeThreshold: 999999,
      surgeWindowSeconds: 1,
    });
    // Unknown mode → off; threshold clamped to 1000; window floored to 5; the
    // emoji list is trimmed, deduped and stripped of non-strings.
    expect(put.config.mode).toBe("off");
    expect(put.config.blockedEmojis).toEqual(["🖕"]);
    expect(put.config.surgeThreshold).toBe(1000);
    expect(put.config.surgeWindowSeconds).toBe(5);
  });

  it("rejects a non-object reactions body", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.updateReactions(reqWith(CTX), "-100", "nope"),
      "invalid-body",
    );
  });
});

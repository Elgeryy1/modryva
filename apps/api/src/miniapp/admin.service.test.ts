import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MiniappAdminService } from "./admin.service.js";

/** Records the token used and returns a fixed admin list. */
class FakeGateway {
  tokens: Array<string | undefined> = [];
  admins: bigint[] = [42n];
  // getChatMember stubs for isBotAdmin: status of the bot's own membership.
  memberOk = true;
  memberStatus: string | undefined = "administrator";
  async getChatAdministrators({
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }) {
    this.tokens.push(token);
    return { ok: true, admins: this.admins.map((userId) => ({ userId })) };
  }
  async getChatMember(_input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }) {
    return this.memberOk
      ? { ok: true, status: this.memberStatus }
      : { ok: false };
  }
}

/** Records the tenant slug looked up so we can assert per-bot routing. */
const makeService = () => {
  const slugs: string[] = [];
  const client = {
    tenant: {
      findUnique: async ({ where }: { where: { slug: string } }) => {
        slugs.push(where.slug);
        return { id: `id-${where.slug}` };
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: minimal PrismaClient stub
  } as any;
  const gateway = new FakeGateway();
  const foundation = {
    findChatByTelegramId: async () => ({ chatId: "c1", title: "Grupo" }),
  };
  const service = new MiniappAdminService(client);
  Object.assign(service, { gateway, foundation });
  return { service, gateway, slugs };
};

describe("MiniappAdminService multi-tenant", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "parent:token";
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  it("uses the child bot's token + tenant when a scope is given", async () => {
    const { service, gateway, slugs } = makeService();
    await service.assertGroupAdmin("-100", "42", {
      username: "childbot",
      token: "child:token",
    });
    expect(gateway.tokens).toEqual(["child:token"]);

    await service.resolveChat("-100", {
      username: "childbot",
      token: "child:token",
    });
    expect(slugs).toContain("telegram-childbot");
    expect(slugs).not.toContain("telegram-modryvabot");
  });

  it("falls back to the primary bot when no scope is given", async () => {
    const { service, gateway, slugs } = makeService();
    await service.assertGroupAdmin("-100", "42");
    expect(gateway.tokens).toEqual(["parent:token"]);
    await service.resolveChat("-100");
    expect(slugs).toContain("telegram-modryvabot");
  });

  it("caches admins per (bot, chat) so different bots don't collide", async () => {
    const { service, gateway } = makeService();
    const child = { username: "childbot", token: "child:token" };
    const parent = { username: "modryvabot", token: "parent:token" };
    await service.assertGroupAdmin("-100", "42", child);
    await service.assertGroupAdmin("-100", "42", child); // cached: no new call
    await service.assertGroupAdmin("-100", "42", parent); // different bot: new call
    expect(gateway.tokens).toEqual(["child:token", "parent:token"]);
  });

  it("re-verifies against Telegram so a just-promoted admin isn't denied by a stale cache", async () => {
    const { service, gateway } = makeService();
    // First call caches the admin list (only 42 is admin).
    gateway.admins = [42n];
    await service.assertGroupAdmin("-100", "42");
    expect(gateway.tokens).toHaveLength(1);

    // 99 gets promoted after the list was cached.
    gateway.admins = [42n, 99n];
    // 99 isn't in the cached list → the service re-verifies fresh and lets them in.
    await expect(
      service.assertGroupAdmin("-100", "99"),
    ).resolves.toBeUndefined();
    expect(gateway.tokens).toHaveLength(2); // one extra (forced) refresh
  });
});

/**
 * The cross-group roster is built from listAdminChats and nothing else, so this
 * method IS its tenant boundary: whatever it returns, that person sees the IPs
 * of. These tests exist to keep it from ever widening by accident.
 */
describe("MiniappAdminService.listAdminChats", () => {
  /** Admin list that differs per chat, unlike FakeGateway's fixed one. */
  class PerChatGateway {
    calls: string[] = [];
    constructor(private readonly adminsByChat: Record<string, bigint[]>) {}
    async getChatAdministrators({ chatId }: { chatId: bigint }) {
      this.calls.push(chatId.toString());
      const admins = this.adminsByChat[chatId.toString()];
      // No entry = Telegram won't confirm this group right now.
      return admins
        ? { ok: true, admins: admins.map((userId) => ({ userId })) }
        : { ok: false };
    }
  }

  const CHATS = [
    { id: "c1", telegramChatId: -100n, title: "Mío", type: "supergroup" },
    { id: "c2", telegramChatId: -200n, title: "Ajeno", type: "supergroup" },
    { id: "c3", telegramChatId: -300n, title: "Caído", type: "supergroup" },
  ];

  const makeScopedService = (adminsByChat: Record<string, bigint[]>) => {
    const queries: unknown[] = [];
    const client = {
      tenant: { findUnique: async () => ({ id: "t1" }) },
      chat: {
        findMany: async (args: unknown) => {
          queries.push(args);
          return CHATS;
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal PrismaClient stub
    } as any;
    const gateway = new PerChatGateway(adminsByChat);
    const service = new MiniappAdminService(client);
    Object.assign(service, { gateway });
    return { service, gateway, queries };
  };

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "parent:token";
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });

  it("returns only the groups where the caller really is an admin", async () => {
    const { service } = makeScopedService({
      "-100": [42n],
      "-200": [99n], // someone else's community
      "-300": [42n],
    });
    const chats = await service.listAdminChats("42");
    expect(chats.map((c) => c.telegramChatId)).toEqual(["-100", "-300"]);
  });

  it("drops a group Telegram won't confirm instead of assuming it", async () => {
    // -300 has no entry → getChatAdministrators returns ok:false. Under-report
    // (a group missing) beats over-report (strangers' IPs on screen).
    const { service } = makeScopedService({ "-100": [42n], "-200": [42n] });
    const chats = await service.listAdminChats("42");
    expect(chats.map((c) => c.telegramChatId)).toEqual(["-100", "-200"]);
  });

  it("never asks Telegram about private chats", async () => {
    const { service, queries } = makeScopedService({ "-100": [42n] });
    await service.listAdminChats("42");
    expect(queries[0]).toMatchObject({
      where: { tenantId: "t1", type: { in: ["group", "supergroup"] } },
    });
  });

  it("gives the platform owner every group without one Telegram call", async () => {
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = "7";
    const { service, gateway } = makeScopedService({});
    const chats = await service.listAdminChats("7");
    expect(chats).toHaveLength(3);
    expect(gateway.calls).toEqual([]);
  });

  it("gives a non-owner nothing when they administer none of them", async () => {
    const { service } = makeScopedService({ "-100": [99n], "-200": [99n] });
    expect(await service.listAdminChats("42")).toEqual([]);
  });

  it("recognises the owner only when the env id matches exactly", async () => {
    const { service } = makeScopedService({});
    expect(service.isPlatformOwner("7")).toBe(false); // env unset = nobody
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = "7";
    expect(service.isPlatformOwner("7")).toBe(true);
    expect(service.isPlatformOwner("70")).toBe(false);
  });
});

describe("MiniappAdminService — a malformed group id is a 400, not a 500", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "parent:token";
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  // BigInt("all") throws a bare SyntaxError, which Nest reports as a server
  // fault — so a bad URL looked like the API was broken. It happened for real:
  // a cached Mini App bundle sent "all" as a chat id and got a 500.
  it("rejects a non-numeric id instead of crashing on BigInt", async () => {
    const { service } = makeService();
    await expect(service.assertGroupAdmin("all", "42")).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.resolveChat("all")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("still accepts real ids, negative ones included", async () => {
    const { service } = makeService();
    await expect(
      service.assertGroupAdmin("-1009000000001", "42"),
    ).resolves.toBeUndefined();
  });
});

describe("MiniappAdminService.isBotAdmin", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "parent:token";
    process.env.TELEGRAM_BOT_USERNAME = "modryvabot";
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  // A numeric token prefix is the bot's own user id — required to query itself.
  const numericBot = { username: "childbot", token: "12345:auth" };

  it("reports true when Telegram says the bot is an administrator", async () => {
    const { service, gateway } = makeService();
    gateway.memberStatus = "administrator";
    expect(await service.isBotAdmin("-100", numericBot)).toBe(true);
  });

  it("reports false when the bot is only a member", async () => {
    const { service, gateway } = makeService();
    gateway.memberStatus = "member";
    expect(await service.isBotAdmin("-100", numericBot)).toBe(false);
  });

  it("fails open (assumes admin) when the bot id can't be parsed from the token", async () => {
    // The env token "parent:token" has a non-numeric id prefix → no bot id.
    const { service } = makeService();
    expect(await service.isBotAdmin("-100")).toBe(true);
  });

  it("fails open when Telegram can't confirm the membership", async () => {
    const { service, gateway } = makeService();
    gateway.memberOk = false;
    expect(await service.isBotAdmin("-100", numericBot)).toBe(true);
  });
});

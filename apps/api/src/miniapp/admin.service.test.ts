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

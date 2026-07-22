import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryD1Repository,
  InMemoryFederationRepository,
  InMemoryOwnerNetworkRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappOwnerNetworkController } from "./owner-network.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeGroupProtection {
  private readonly gates = new Map<string, bigint[]>();
  async setMembershipGates(
    _tenantId: string,
    chatId: string,
    _telegramChatId: bigint,
    requiredTelegramChatIds: readonly bigint[],
  ) {
    this.gates.set(chatId, [...requiredTelegramChatIds]);
    return requiredTelegramChatIds.map((id) => ({
      requiredTelegramChatId: id,
    }));
  }
  async listMembershipGates(chatId: string) {
    return (this.gates.get(chatId) ?? []).map((id) => ({
      requiredTelegramChatId: id,
    }));
  }
}

class FakeWelcome {
  readonly configs = new Map<
    string,
    {
      welcomeText: string | null;
      goodbyeText: string | null;
      rulesText: string | null;
    }
  >();
  async getConfig(chatId: string) {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const current = this.configs.get(chatId) ?? {
      welcomeText: null,
      goodbyeText: null,
      rulesText: null,
    };
    const next = { ...current, ...patch };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeFoundation {
  readonly audits: unknown[] = [];
  async findChatByTelegramId(_tenantId: string, telegramChatId: bigint) {
    return {
      chatId: `chat_${telegramChatId}`,
      title: `Grupo ${telegramChatId}`,
    };
  }
  async recordAudit(input: unknown) {
    this.audits.push(input);
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

  const controller = new MiniappOwnerNetworkController(admin);
  const federation = new InMemoryFederationRepository();
  const ownerNetwork = new InMemoryOwnerNetworkRepository();
  const d1 = new InMemoryD1Repository();
  const groupProtection = new FakeGroupProtection();
  const welcome = new FakeWelcome();
  const foundation = new FakeFoundation();

  Object.assign(controller, {
    federation,
    ownerNetwork,
    d1,
    groupProtection,
    welcome,
    foundation,
  });

  return { controller, federation, ownerNetwork, d1, foundation };
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

describe("MiniappOwnerNetworkController", () => {
  it("returns inNetwork:false for a group with no network", async () => {
    const { controller } = makeController();
    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    expect(status).toEqual({ inNetwork: false });
  });

  it("rejects reading network status when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.status(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("creates a network and reports the owner as network admin", async () => {
    const { controller } = makeController();
    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Mi Red",
    });
    expect(created).toMatchObject({
      inNetwork: true,
      isOwner: true,
      isNetworkAdmin: true,
      chatCount: 1,
    });
  });

  it("rejects creating a network with an empty name", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.create(reqWith(ctxFor("42")), "-100", { name: "  " }),
      "invalid-name",
    );
  });

  it("blocks a non-owner, non-admin member from updating global routes", async () => {
    const { controller, federation } = makeController();
    // Owner (42) creates the network from group c1 / telegram -100.
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    // A different group (c2) joins the same network as a plain member chat.
    const fed = await federation.getFederationForChat("c1");
    await federation.joinFederation(fed?.fedId ?? "", "c2", -200n);

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
      memberController.updateRouting(reqWith(ctxFor("99")), "-200", {
        roles: [],
        routes: [],
      }),
      "not-network-admin",
    );
  });

  it("allows the network owner to configure roles and routes", async () => {
    const { controller, federation } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });
    const fed = await federation.getFederationForChat("c1");
    await federation.joinFederation(fed?.fedId ?? "", "c2", -200n);

    const result = await controller.updateRouting(
      reqWith(ctxFor("42")),
      "-100",
      {
        roles: [{ chatId: "c2", roles: ["staff"], label: null }],
        routes: [
          { sourceChatId: null, eventKind: "reports", targetChatId: "c2" },
        ],
      },
    );

    expect(result).toMatchObject({ inNetwork: true });
    expect((result as { routes: unknown[] }).routes).toHaveLength(1);
  });

  it("rejects an unknown eventKind in the routing body", async () => {
    const { controller } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    await expectHttpErrorAsync(
      controller.updateRouting(reqWith(ctxFor("42")), "-100", {
        roles: [],
        routes: [
          {
            sourceChatId: null,
            eventKind: "not-a-real-kind",
            targetChatId: "c1",
          },
        ],
      }),
      "invalid-body",
    );
  });

  it("rejects an unknown role in the routing body", async () => {
    const { controller } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    await expectHttpErrorAsync(
      controller.updateRouting(reqWith(ctxFor("42")), "-100", {
        roles: [{ chatId: "c1", roles: ["dictator"], label: null }],
        routes: [],
      }),
      "invalid-body",
    );
  });

  it("rejects a route pointing at a chat outside the network", async () => {
    const { controller } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    await expectHttpErrorAsync(
      controller.updateRouting(reqWith(ctxFor("42")), "-100", {
        roles: [],
        routes: [
          {
            sourceChatId: null,
            eventKind: "reports",
            targetChatId: "chat_not_in_network",
          },
        ],
      }),
      "route-chat-not-in-network",
    );
  });

  it("rejects a rollback when there is no snapshot yet", async () => {
    const { controller } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    await expectHttpErrorAsync(
      controller.rollback(reqWith(ctxFor("42")), "-100"),
      "no-snapshot",
    );
  });

  it("snapshots before a settings apply and rolls it back", async () => {
    const { controller } = makeController();
    await controller.create(reqWith(ctxFor("42")), "-100", { name: "Red" });

    await controller.updateSettings(reqWith(ctxFor("42")), "-100", {
      logTelegramChatId: "-500",
      welcomeMode: "global",
      welcomeText: "Hola a todos",
      goodbyeText: null,
      rulesMode: "per_group",
      rulesText: null,
      membershipMode: "off",
    });

    const rolledBack = await controller.rollback(reqWith(ctxFor("42")), "-100");
    expect(
      (rolledBack as { policy: { welcomeText: string | null } }).policy,
    ).toMatchObject({ welcomeText: null, logTelegramChatId: null });
  });

  it("rejects joining a network that does not exist", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.join(reqWith(ctxFor("42")), "-100", {
        networkId: "does-not-exist",
      }),
      "network-not-found",
    );
  });
});

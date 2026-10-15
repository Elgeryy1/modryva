import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryEntitlementRepository,
  InMemoryFederationRepository,
} from "@superbot/data";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import { MiniappEntitlementController } from "./entitlement.controller.js";
import type { MiniappRequest } from "./init-data.guard.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

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

  const controller = new MiniappEntitlementController(admin);
  const federation = new InMemoryFederationRepository();
  const entitlement = new InMemoryEntitlementRepository();

  Object.assign(controller, { federation, entitlement });

  return { controller, federation, entitlement };
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

describe("MiniappEntitlementController", () => {
  const OWNER_ID = "555";
  const originalOwnerEnv = process.env.SUPERBOT_OWNER_TELEGRAM_ID;

  beforeEach(() => {
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = OWNER_ID;
  });

  afterEach(() => {
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = originalOwnerEnv;
  });

  it("returns free defaults for a group with no network", async () => {
    const { controller } = makeController();
    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    expect(status).toMatchObject({
      inNetwork: false,
      plan: "free",
      maxChats: 3,
    });
  });

  it("rejects reading entitlement status when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.status(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("redeems a valid code for the network owner", async () => {
    const { controller, federation, entitlement } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const code = await entitlement.generateCode("555", "pro", 10, 30);
    const result = await controller.redeem(reqWith(ctxFor("42")), "-100", {
      code,
    });
    expect(result).toMatchObject({
      inNetwork: true,
      plan: "pro",
      maxChats: 10,
    });
  });

  it("rejects redeeming an already-used code", async () => {
    const { controller, federation, entitlement } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const code = await entitlement.generateCode("555", "pro", 10, 30);
    await controller.redeem(reqWith(ctxFor("42")), "-100", { code });

    await expectHttpErrorAsync(
      controller.redeem(reqWith(ctxFor("42")), "-100", { code }),
      "already-used",
    );
  });

  it("rejects redeeming a code that does not exist", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    await expectHttpErrorAsync(
      controller.redeem(reqWith(ctxFor("42")), "-100", {
        code: "does-not-exist",
      }),
      "not-found",
    );
  });

  it("blocks a non-network-admin from redeeming a code", async () => {
    const { federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c2", -200n);

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
      memberController.redeem(reqWith(ctxFor("99")), "-200", {
        code: "whatever",
      }),
      "not-network-admin",
    );
  });

  it("allows the platform owner to generate a code", async () => {
    const { controller } = makeController();
    const result = await controller.generateCode(
      reqWith(ctxFor(OWNER_ID)),
      "-100",
      { plan: "pro", maxChats: 10, days: 30 },
    );
    expect(result.code).toBeTruthy();
  });

  it("allows the platform owner to generate a code when the env var has surrounding whitespace", async () => {
    process.env.SUPERBOT_OWNER_TELEGRAM_ID = ` ${OWNER_ID} `;
    const { controller } = makeController();
    const result = await controller.generateCode(
      reqWith(ctxFor(OWNER_ID)),
      "-100",
      { plan: "pro", maxChats: 10, days: 30 },
    );
    expect(result.code).toBeTruthy();
  });

  it("rejects generating a code for anyone other than the platform owner", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.generateCode(reqWith(ctxFor("42")), "-100", {
        plan: "pro",
        maxChats: 10,
        days: 30,
      }),
      "not-platform-owner",
    );
  });

  it("rejects generating a code when SUPERBOT_OWNER_TELEGRAM_ID is unset", async () => {
    delete process.env.SUPERBOT_OWNER_TELEGRAM_ID;
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.generateCode(reqWith(ctxFor(OWNER_ID)), "-100", {
        plan: "pro",
        maxChats: 10,
        days: 30,
      }),
      "not-platform-owner",
    );
  });
});

import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryFederationRepository,
  InMemoryOwnerNetworkRiskRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappNetworkRiskController } from "./network-risk.controller.js";

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

  const controller = new MiniappNetworkRiskController(admin);
  const federation = new InMemoryFederationRepository();
  const risk = new InMemoryOwnerNetworkRiskRepository();

  Object.assign(controller, { federation, risk });

  return { controller, federation, risk };
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

describe("MiniappNetworkRiskController", () => {
  it("returns inNetwork:false when the group has no network", async () => {
    const { controller } = makeController();
    const result = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(result).toEqual({ inNetwork: false });
  });

  it("rejects listing when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.list(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("rejects listing for a network member who is not a network admin", async () => {
    const { controller, federation } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);

    await expectHttpErrorAsync(
      controller.list(reqWith(ctxFor("99")), "-100"),
      "not-network-admin",
    );
  });

  it("allows the network owner to list risk users", async () => {
    const { controller, federation, risk } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);
    await risk.recordSignal("t1", "f1", 7n, "c1", "sanction");

    const result = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(result).toMatchObject({ inNetwork: true, networkId: "f1" });
    expect(
      (result as { users: { telegramUserId: string; score: number }[] }).users,
    ).toEqual([
      expect.objectContaining({
        telegramUserId: "7",
        score: 8,
        classification: "low",
      }),
    ]);
  });

  it("allows a fed-admin (non-owner) to list risk users", async () => {
    const { controller, federation } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);
    await federation.addFedAdmin(fed.fedId, 99n);

    const result = await controller.list(reqWith(ctxFor("99")), "-100");
    expect(result).toMatchObject({ inNetwork: true });
  });

  it("orders listed users by score descending", async () => {
    const { controller, federation, risk } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);
    await risk.recordSignal("t1", "f1", 1n, "c1", "link");
    await risk.recordSignal("t1", "f1", 2n, "c1", "sanction");

    const result = (await controller.list(reqWith(ctxFor("42")), "-100")) as {
      users: { telegramUserId: string }[];
    };
    expect(result.users.map((u) => u.telegramUserId)).toEqual(["2", "1"]);
  });

  it("rejects resetting when the group is not in a network", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.reset(reqWith(ctxFor("42")), "-100", "7"),
      "not-in-network",
    );
  });

  it("rejects resetting for a non-network-admin", async () => {
    const { controller, federation } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);

    await expectHttpErrorAsync(
      controller.reset(reqWith(ctxFor("99")), "-100", "7"),
      "not-network-admin",
    );
  });

  it("allows the network owner to reset a user's profile", async () => {
    const { controller, federation, risk } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);
    await risk.recordSignal("t1", "f1", 7n, "c1", "sanction");

    const result = await controller.reset(reqWith(ctxFor("42")), "-100", "7");
    expect(result).toEqual({ ok: true });
    expect(await risk.getProfile("f1", 7n)).toBeNull();
  });

  it("rejects a malformed userId on reset", async () => {
    const { controller, federation } = makeController();
    const fed = await federation.createFederation({
      tenantId: "t1",
      fedId: "f1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation(fed.fedId, "c1", -100n);

    await expectHttpErrorAsync(
      controller.reset(reqWith(ctxFor("42")), "-100", "not-a-number"),
      "invalid-user-id",
    );
  });
});

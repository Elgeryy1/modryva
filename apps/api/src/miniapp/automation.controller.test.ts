import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryAutomationRepository,
  InMemoryFederationRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import { MiniappAutomationController } from "./automation.controller.js";
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

  const controller = new MiniappAutomationController(admin);
  const automations = new InMemoryAutomationRepository();
  const federation = new InMemoryFederationRepository();

  Object.assign(controller, { automations, federation });

  return { controller, automations, federation };
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

const setupNetwork = async (federation: InMemoryFederationRepository) => {
  const fed = await federation.createFederation({
    tenantId: "t1",
    fedId: "fed1",
    name: "Red",
    ownerTelegramId: 42n,
  });
  await federation.joinFederation(fed.fedId, "c1", -100n);
  return fed;
};

describe("MiniappAutomationController", () => {
  it("returns an empty list when the group is not in a network", async () => {
    const { controller } = makeController();
    const result = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(result).toEqual({ automations: [] });
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

  it("creates a chat-scoped automation by default", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);

    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Borra enlaces",
      trigger: { kind: "contains_link" },
      condition: { kind: "none" },
      action: { kind: "delete" },
    });

    expect(created).toMatchObject({
      name: "Borra enlaces",
      chatId: "c1",
      enabled: true,
    });
  });

  it("creates a network-wide automation when scope is network", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);

    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Bienvenida global",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "log", text: "nuevo" },
      scope: "network",
    });

    expect(created).toMatchObject({ chatId: null });
  });

  it("rejects creating an automation when the group is not in a network", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.create(reqWith(ctxFor("42")), "-100", {
        name: "x",
        trigger: { kind: "new_member" },
        condition: { kind: "none" },
        action: { kind: "delete" },
      }),
      "not-in-network",
    );
  });

  it("rejects an invalid trigger kind", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);

    await expectHttpErrorAsync(
      controller.create(reqWith(ctxFor("42")), "-100", {
        name: "x",
        trigger: { kind: "not-a-real-kind" },
        condition: { kind: "none" },
        action: { kind: "delete" },
      }),
      "invalid-body",
    );
  });

  it("rejects an empty name", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);

    await expectHttpErrorAsync(
      controller.create(reqWith(ctxFor("42")), "-100", {
        name: "",
        trigger: { kind: "new_member" },
        condition: { kind: "none" },
        action: { kind: "delete" },
      }),
      "invalid-body",
    );
  });

  it("lists automations scoped to the chat plus network-wide ones", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);

    await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Global",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "log", text: "x" },
      scope: "network",
    });
    await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Solo grupo",
      trigger: { kind: "report" },
      condition: { kind: "none" },
      action: { kind: "notify_staff", text: "y" },
    });

    const result = (await controller.list(reqWith(ctxFor("42")), "-100")) as {
      automations: { name: string }[];
    };
    expect(result.automations.map((a) => a.name).sort()).toEqual([
      "Global",
      "Solo grupo",
    ]);
  });

  it("updates an automation's fields", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);
    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Original",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "delete" },
    });

    const updated = await controller.update(
      reqWith(ctxFor("42")),
      "-100",
      (created as { id: string }).id,
      { name: "Renombrada", enabled: false },
    );

    expect(updated).toMatchObject({ name: "Renombrada", enabled: false });
  });

  it("rejects updating an automation that doesn't belong to this group", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);
    // A second group, c2, in a different network entirely.
    const otherFed = await federation.createFederation({
      tenantId: "t1",
      fedId: "fed2",
      name: "Otra red",
      ownerTelegramId: 99n,
    });
    await federation.joinFederation(otherFed.fedId, "c2", -200n);

    const { controller: c2Controller } = makeController(
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
    Object.assign(c2Controller, { federation });

    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Original",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "delete" },
    });

    await expectHttpErrorAsync(
      c2Controller.update(
        reqWith(ctxFor("99")),
        "-200",
        (created as { id: string }).id,
        { name: "Hackeada" },
      ),
      "not-found",
    );
  });

  it("deletes an automation", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);
    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Borrar",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "delete" },
    });

    const result = await controller.remove(
      reqWith(ctxFor("42")),
      "-100",
      (created as { id: string }).id,
    );
    expect(result).toEqual({ ok: true });

    const list = (await controller.list(reqWith(ctxFor("42")), "-100")) as {
      automations: unknown[];
    };
    expect(list.automations).toHaveLength(0);
  });

  it("rejects deleting an unknown automation id", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);
    await expectHttpErrorAsync(
      controller.remove(reqWith(ctxFor("42")), "-100", "nope"),
      "not-found",
    );
  });

  it("toggles an automation enabled state", async () => {
    const { controller, federation } = makeController();
    await setupNetwork(federation);
    const created = await controller.create(reqWith(ctxFor("42")), "-100", {
      name: "Toggle",
      trigger: { kind: "new_member" },
      condition: { kind: "none" },
      action: { kind: "delete" },
    });

    const toggled = await controller.toggle(
      reqWith(ctxFor("42")),
      "-100",
      (created as { id: string }).id,
      { enabled: false },
    );
    expect(toggled).toEqual({ ok: true });

    const list = (await controller.list(reqWith(ctxFor("42")), "-100")) as {
      automations: { enabled: boolean }[];
    };
    expect(list.automations[0]?.enabled).toBe(false);
  });
});

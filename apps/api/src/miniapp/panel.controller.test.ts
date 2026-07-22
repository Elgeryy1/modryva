import { ForbiddenException, type HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappPanelController } from "./panel.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeSettings {
  readonly store = new Map<string, unknown>();
  private key(t: string, c: string, k: string): string {
    return `${t}:${c}:${k}`;
  }
  async getValue(t: string, c: string, k: string): Promise<unknown> {
    return this.store.get(this.key(t, c, k));
  }
  async setValue(t: string, c: string, k: string, v: unknown): Promise<void> {
    this.store.set(this.key(t, c, k), v);
  }
}

class FakeFoundation {
  readonly audits: Array<Record<string, unknown>> = [];
  async recordAudit(input: Record<string, unknown>) {
    this.audits.push(input);
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

  const controller = new MiniappPanelController(admin);
  const settings = new FakeSettings();
  const foundation = new FakeFoundation();
  Object.assign(controller, { settings, foundation });
  return { controller, settings, foundation };
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

describe("MiniappPanelController", () => {
  it("rejects when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.get(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("returns sensible defaults with no stored settings", async () => {
    const { controller } = makeController();
    const res = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(res.dock.active).toContain("hoy");
    expect(res.density.current).toBe("normal");
    expect(res.voice.current).toBe("serio");
    expect(res.moduleNames.find((m) => m.key === "inbox")?.current).toBe(
      "Bandeja de entrada",
    );
  });

  it("toggles a dock item off", async () => {
    const { controller, foundation } = makeController();
    const res = await controller.setDock(reqWith(ctxFor("42")), "-100", {
      id: "hoy",
    });
    expect(res.active).not.toContain("hoy");
    expect(foundation.audits).toHaveLength(1);

    const after = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(after.dock.active).not.toContain("hoy");
  });

  it("rejects an unknown dock item", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.setDock(reqWith(ctxFor("42")), "-100", { id: "nope" }),
      "invalid-dock-item",
    );
  });

  it("renames a module and resets it back to default", async () => {
    const { controller } = makeController();
    await controller.setModuleName(reqWith(ctxFor("42")), "-100", {
      key: "inbox",
      name: "Mesa de staff",
    });
    let res = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(res.moduleNames.find((m) => m.key === "inbox")?.current).toBe(
      "Mesa de staff",
    );

    // Empty name → reset to default.
    await controller.setModuleName(reqWith(ctxFor("42")), "-100", {
      key: "inbox",
      name: "",
    });
    res = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(res.moduleNames.find((m) => m.key === "inbox")?.current).toBe(
      "Bandeja de entrada",
    );
  });

  it("rejects an unknown module key", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.setModuleName(reqWith(ctxFor("42")), "-100", {
        key: "not-a-module",
        name: "x",
      }),
      "invalid-module",
    );
  });

  it("sets density per user and rejects invalid modes", async () => {
    const { controller } = makeController();
    await controller.setDensity(reqWith(ctxFor("42")), "-100", {
      mode: "compacto",
    });
    // Same user sees their mode…
    const mine = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(mine.density.current).toBe("compacto");
    // …a different admin still sees the default.
    const other = await controller.get(reqWith(ctxFor("99")), "-100");
    expect(other.density.current).toBe("normal");

    await expectHttpErrorAsync(
      controller.setDensity(reqWith(ctxFor("42")), "-100", { mode: "turbo" }),
      "invalid-density",
    );
  });

  it("sets the bot voice and rejects invalid tones", async () => {
    const { controller } = makeController();
    await controller.setVoice(reqWith(ctxFor("42")), "-100", {
      voice: "gamer",
    });
    const res = await controller.get(reqWith(ctxFor("42")), "-100");
    expect(res.voice.current).toBe("gamer");

    await expectHttpErrorAsync(
      controller.setVoice(reqWith(ctxFor("42")), "-100", { voice: "payaso" }),
      "invalid-voice",
    );
  });
});

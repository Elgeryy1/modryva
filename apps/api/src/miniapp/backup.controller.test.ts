import { ForbiddenException, type HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import { MiniappBackupController } from "./backup.controller.js";
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

class FakeFlood {
  readonly configs = new Map<string, Record<string, unknown>>();
  async getConfig(_tenantId: string, chatId: string) {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const next = { ...(this.configs.get(chatId) ?? {}), ...patch };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeCaptcha {
  readonly configs = new Map<string, Record<string, unknown>>();
  async getConfig(_tenantId: string, chatId: string) {
    return this.configs.get(chatId) ?? null;
  }
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const next = { ...(this.configs.get(chatId) ?? {}), ...patch };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeLocks {
  readonly locked = new Map<string, string[]>();
  async getLocked(_tenantId: string, chatId: string) {
    return this.locked.get(chatId) ?? [];
  }
  async setLocked(
    _tenantId: string,
    chatId: string,
    locked: readonly string[],
  ) {
    const unique = [...new Set(locked)];
    this.locked.set(chatId, unique);
    return unique;
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

class FakeFoundation {
  readonly audits: unknown[] = [];
  async recordAudit(input: unknown) {
    this.audits.push(input);
  }
}

const defaultWelcomeButtons = {
  rules: true,
  otherGroups: true,
  support: true,
  verify: false,
};

class FakeGamification {
  readonly welcomeButtons = new Map<string, typeof defaultWelcomeButtons>();
  async getWelcomeButtons(_tenantId: string, chatId: string) {
    return this.welcomeButtons.get(chatId) ?? { ...defaultWelcomeButtons };
  }
  async setWelcomeButtons(
    _tenantId: string,
    chatId: string,
    state: typeof defaultWelcomeButtons,
  ) {
    const next = { ...state };
    this.welcomeButtons.set(chatId, next);
    return next;
  }
}

class FakeFederation {
  async getFederationForChat(_chatId: string) {
    return null;
  }
}

const makeController = (
  adminOverrides: Partial<MiniappAdminService> = {},
  chatByGid: Record<string, string> = { "-100": "c1" },
) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId: chatByGid[gid] ?? `chat_${gid}`,
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappBackupController(admin);
  const welcome = new FakeWelcome();
  const flood = new FakeFlood();
  const captcha = new FakeCaptcha();
  const locks = new FakeLocks();
  const warns = new FakeWarns();
  const hygiene = new FakeHygiene();
  const foundation = new FakeFoundation();
  const gamification = new FakeGamification();
  const federation = new FakeFederation();

  Object.assign(controller, {
    welcome,
    flood,
    captcha,
    locks,
    warns,
    hygiene,
    foundation,
    gamification,
    federation,
  });

  return {
    controller,
    welcome,
    flood,
    captcha,
    locks,
    warns,
    hygiene,
    foundation,
    gamification,
    federation,
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

describe("MiniappBackupController", () => {
  it("exports a payload with version 2 and default sections", async () => {
    const { controller } = makeController();
    const backup = await controller.export(reqWith(CTX), "-100");
    expect(backup.version).toBe(2);
    expect(backup.network).toBeNull();
    expect(backup.sections.flood.enabled).toBe(false);
    expect(backup.sections.welcome.welcomeText).toBeNull();
    expect(backup.sections.gamificationWelcomeButtons).toEqual(
      defaultWelcomeButtons,
    );
  });

  it("round-trips export -> import preserving values", async () => {
    const { controller, welcome } = makeController();
    welcome.configs.set("c1", {
      welcomeText: "Hola!",
      goodbyeText: "Adios",
      rulesText: "1. Se amable",
    });
    const exported = await controller.export(reqWith(CTX), "-100");

    const { controller: freshController, welcome: freshWelcome } =
      makeController();
    await freshController.import(reqWith(CTX), "-100", { payload: exported });

    const roundTripped = await freshController.export(reqWith(CTX), "-100");
    expect(roundTripped.sections).toEqual(exported.sections);
    expect(freshWelcome.configs.get("c1")?.welcomeText).toBe("Hola!");
  });

  it("rejects import with an invalid payload (bad version)", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.import(reqWith(CTX), "-100", {
        payload: { version: 3, sections: {} },
      }),
      "invalid-payload",
    );
  });

  it("rejects import with a missing sections object", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.import(reqWith(CTX), "-100", {
        payload: { version: 2 },
      }),
      "invalid-payload",
    );
  });

  it("clones config from one group to another when admin of both", async () => {
    const { controller, welcome } = makeController(
      {},
      { "-100": "c1", "-200": "c2" },
    );
    welcome.configs.set("c1", {
      welcomeText: "Origen",
      goodbyeText: null,
      rulesText: null,
    });

    const cloned = await controller.clone(reqWith(CTX), "-100", {
      targetGid: "-200",
    });
    expect(cloned.sections.welcome.welcomeText).toBe("Origen");
    expect(welcome.configs.get("c2")?.welcomeText).toBe("Origen");
  });

  it("rejects cloning when the caller is not admin of the target group", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async (gid: string) => {
        if (gid === "-200") {
          throw new ForbiddenException({ error: "not-admin" });
        }
      },
    });

    await expect(
      controller.clone(reqWith(CTX), "-100", { targetGid: "-200" }),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("rejects cloning with an empty targetGid", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.clone(reqWith(CTX), "-100", { targetGid: "  " }),
      "invalid-target",
    );
  });

  it("lists the hardcoded template catalog", async () => {
    const { controller } = makeController();
    const { templates } = await controller.templates(reqWith(CTX), "-100");
    expect(templates.length).toBeGreaterThanOrEqual(6);
    expect(templates.map((t) => t.id)).toContain("community");
    expect(templates.map((t) => t.id)).toContain("crypto");
  });

  it("applies a template as an import and returns the resulting config", async () => {
    const { controller, welcome } = makeController();
    const result = await controller.applyTemplate(
      reqWith(CTX),
      "-100",
      "community",
    );
    expect(result.sections.welcome.welcomeText).toContain("Bienvenido");
    expect(welcome.configs.get("c1")?.welcomeText).toContain("Bienvenido");
  });

  it("rejects applying an unknown template id", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.applyTemplate(reqWith(CTX), "-100", "not-a-template"),
      "unknown-template",
    );
  });

  it("propagates a 403 when the user is not an admin for export", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(controller.export(reqWith(CTX), "-100")).rejects.toThrowError(
      ForbiddenException,
    );
  });
});

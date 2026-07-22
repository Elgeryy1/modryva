import { ForbiddenException, type HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import {
  MiniappWizardController,
  type WizardPlaybookId,
} from "./wizard.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeCaptcha {
  readonly configs = new Map<string, Record<string, unknown>>();
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: Record<string, unknown>,
  ) {
    const next = { ...(this.configs.get(chatId) ?? {}), ...update };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeFlood {
  readonly configs = new Map<string, Record<string, unknown>>();
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: Record<string, unknown>,
  ) {
    const next = { ...(this.configs.get(chatId) ?? {}), ...update };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeLocks {
  readonly locked = new Map<string, string[]>();
  async setLocked(
    _tenantId: string,
    chatId: string,
    locked: readonly string[],
  ) {
    const unique = [...new Set(locked)].sort();
    this.locked.set(chatId, unique);
    return unique;
  }
}

class FakeHygiene {
  readonly gates = new Map<string, bigint | null>();
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

class FakeWelcome {
  readonly configs = new Map<string, Record<string, unknown>>();
  async upsertConfig(
    _tenantId: string,
    chatId: string,
    update: Record<string, unknown>,
  ) {
    const next = { ...(this.configs.get(chatId) ?? {}), ...update };
    this.configs.set(chatId, next);
    return next;
  }
}

class FakeD1 {
  readonly quarantine = new Map<string, Record<string, unknown>>();
  readonly logChannels = new Map<string, bigint>();
  async setQuarantineConfig(
    _tenantId: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) {
    const next = { ...(this.quarantine.get(chatId) ?? {}), ...patch };
    this.quarantine.set(chatId, next);
    return next;
  }
  async setLogChannel(
    _tenantId: string,
    chatId: string,
    logTelegramChatId: bigint,
  ) {
    this.logChannels.set(chatId, logTelegramChatId);
    return { enabled: true, logTelegramChatId };
  }
}

class FakeFoundation {
  readonly audits: unknown[] = [];
  async recordAudit(input: unknown) {
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

  const controller = new MiniappWizardController(admin);
  const captcha = new FakeCaptcha();
  const flood = new FakeFlood();
  const locks = new FakeLocks();
  const hygiene = new FakeHygiene();
  const welcome = new FakeWelcome();
  const d1 = new FakeD1();
  const foundation = new FakeFoundation();

  Object.assign(controller, {
    captcha,
    flood,
    locks,
    hygiene,
    welcome,
    d1,
    foundation,
  });

  return {
    controller,
    captcha,
    flood,
    locks,
    hygiene,
    welcome,
    d1,
    foundation,
  };
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

const ALL_PLAYBOOKS: WizardPlaybookId[] = [
  "comunidad_limpia",
  "ventas_sin_spam",
  "solo_miembros_verificados",
  "modo_raid",
  "anuncios",
  "soporte",
];

describe("MiniappWizardController", () => {
  it("lists the playbook catalog without applying anything", async () => {
    const { controller, captcha } = makeController();
    const result = await controller.playbooks(reqWith(ctxFor("42")), "-100");
    expect(result.playbooks).toHaveLength(6);
    expect(result.playbooks.map((p) => p.id).sort()).toEqual(
      [...ALL_PLAYBOOKS].sort(),
    );
    expect(captcha.configs.size).toBe(0);
  });

  it("rejects an unknown playbook id", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.apply(reqWith(ctxFor("42")), "-100", {
        playbook: "no-existe",
        security: "normal",
      }),
      "invalid-playbook",
    );
  });

  it("rejects applying a playbook when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.apply(reqWith(ctxFor("42")), "-100", {
        playbook: "comunidad_limpia",
        security: "normal",
      }),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("changes the applied values when the security level changes", async () => {
    const { controller, captcha, flood, locks } = makeController();

    await controller.apply(reqWith(ctxFor("42")), "-100", {
      playbook: "comunidad_limpia",
      security: "soft",
    });
    const softCaptcha = captcha.configs.get("c1");
    const softFlood = flood.configs.get("c1");
    const softLocks = locks.locked.get("c1");

    await controller.apply(reqWith(ctxFor("42")), "-100", {
      playbook: "comunidad_limpia",
      security: "strict",
    });
    const strictCaptcha = captcha.configs.get("c1");
    const strictFlood = flood.configs.get("c1");
    const strictLocks = locks.locked.get("c1");

    expect(softCaptcha?.enabled).toBe(false);
    expect(strictCaptcha?.enabled).toBe(true);
    expect(strictCaptcha?.mode).toBe("math");
    expect(
      (strictFlood?.messageLimit as number) <
        (softFlood?.messageLimit as number),
    ).toBe(true);
    expect((strictLocks ?? []).length).toBeGreaterThan(
      (softLocks ?? []).length,
    );
  });

  for (const playbookId of ALL_PLAYBOOKS) {
    it(`applies ${playbookId} with the correct shape of config`, async () => {
      const { controller, captcha, flood, locks, d1, welcome, foundation } =
        makeController();

      const result = await controller.apply(reqWith(ctxFor("42")), "-100", {
        playbook: playbookId,
        security: "normal",
        logsChatId: "-200",
      });

      expect(result).toMatchObject({
        ok: true,
        playbook: playbookId,
        security: "normal",
      });

      const captchaConfig = captcha.configs.get("c1");
      expect(captchaConfig).toBeDefined();
      expect(typeof captchaConfig?.enabled).toBe("boolean");
      expect(["button", "math", "text"]).toContain(captchaConfig?.mode);

      const floodConfig = flood.configs.get("c1");
      expect(floodConfig).toBeDefined();
      expect(typeof floodConfig?.messageLimit).toBe("number");

      const lockedSet = locks.locked.get("c1");
      expect(Array.isArray(lockedSet)).toBe(true);

      const quarantineConfig = d1.quarantine.get("c1");
      expect(quarantineConfig).toBeDefined();

      const welcomeConfig = welcome.configs.get("c1");
      expect(typeof welcomeConfig?.welcomeText).toBe("string");
      expect(typeof welcomeConfig?.rulesText).toBe("string");

      expect(d1.logChannels.get("c1")).toBe(-200n);

      expect(foundation.audits).toHaveLength(1);
      expect(foundation.audits[0]).toMatchObject({
        action: "miniapp.wizard.applied",
        payload: { playbook: playbookId, security: "normal" },
      });
    });
  }

  it("falls back to staffChatId for logs when logsChatId is absent", async () => {
    const { controller, d1 } = makeController();
    await controller.apply(reqWith(ctxFor("42")), "-100", {
      playbook: "solo_miembros_verificados",
      security: "normal",
      staffChatId: "-300",
    });
    expect(d1.logChannels.get("c1")).toBe(-300n);
  });

  it("sets a membership gate only for playbooks that require it", async () => {
    const { controller, hygiene } = makeController();
    await controller.apply(reqWith(ctxFor("42")), "-100", {
      playbook: "solo_miembros_verificados",
      security: "normal",
      staffChatId: "-300",
    });
    expect(hygiene.gates.get("c1")).toBe(-300n);

    const { controller: controller2, hygiene: hygiene2 } = makeController();
    await controller2.apply(reqWith(ctxFor("42")), "-100", {
      playbook: "comunidad_limpia",
      security: "normal",
      staffChatId: "-300",
    });
    expect(hygiene2.gates.get("c1")).toBeNull();
  });
});

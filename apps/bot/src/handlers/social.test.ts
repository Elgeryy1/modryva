import {
  InMemoryChatSettingRepository,
  InMemorySocialRepository,
} from "@superbot/data";
import type { TelegramUpdateEnvelope } from "@superbot/domain";
import {
  fixedClock,
  type ModerationPort,
  SOCIAL_SETTINGS_KEY,
  sequenceRandom,
} from "@superbot/module-social";
import { beforeEach, describe, expect, it } from "vitest";
import { type SocialAuditInput, SocialHandlers } from "./social.js";

/**
 * The wiring, not the rules — the rules are pinned in modules/social. What is
 * checked here is that the handler asks the right questions in the right order
 * and, above all, that it cannot sanction anybody the moderation stack would
 * refuse to sanction.
 */

const TENANT = "tenant-1";
const CHAT_ROW = "chat-row-1";
const CHAT = -1001n;

const context = { tenantId: TENANT, chatId: CHAT_ROW };

const update = (
  command: string,
  args: readonly string[] = [],
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope =>
  ({
    updateId: 1,
    kind: "message",
    receivedAt: new Date("2026-07-30T10:00:00Z"),
    chat: { chatId: CHAT, chatType: "supergroup", topicId: undefined },
    user: {
      userId: 555n,
      username: "ana",
      firstName: "Ana",
      languageCode: "es",
    },
    command: { name: command, raw: `/${command}`, args },
    callbackData: undefined,
    messageText: `/${command}`,
    content: {
      hasText: true,
      hasUrl: false,
      hasMention: false,
      isForward: false,
      viaBot: false,
      hasPhoto: false,
      hasVideo: false,
      hasAnimation: false,
      hasSticker: false,
      hasAudio: false,
      hasVoice: false,
      hasDocument: false,
      hasContact: false,
      hasLocation: false,
      hasPoll: false,
    },
    attachment: undefined,
    preCheckout: undefined,
    successfulPayment: undefined,
    inlineQuery: undefined,
    messageId: 900,
    newChatMemberIds: [],
    isTextMessage: true,
    raw: {},
    ...overrides,
  }) as TelegramUpdateEnvelope;

interface Harness {
  readonly handlers: SocialHandlers;
  readonly social: InMemorySocialRepository;
  readonly settings: InMemoryChatSettingRepository;
  readonly audits: SocialAuditInput[];
  readonly mutes: { userId: bigint; seconds: number }[];
}

const makeHarness = (
  moderationOverrides: Partial<ModerationPort> = {},
  draws: readonly number[] = [0],
  /**
   * El interruptor maestro. Los tests de comportamiento lo encienden porque
   * prueban qué hace el módulo cuando existe; `describe("apagado")` de más
   * abajo comprueba lo contrario.
   */
  enabled = true,
): Harness => {
  const social = new InMemorySocialRepository();
  const settings = new InMemoryChatSettingRepository();
  const audits: SocialAuditInput[] = [];
  const mutes: { userId: bigint; seconds: number }[] = [];

  const moderation: ModerationPort = {
    canRestrict: async () => true,
    isProtected: async () => false,
    mute: async (request) => {
      mutes.push({ userId: request.targetUserId, seconds: request.seconds });
      return { ok: true, caseNumber: 1 };
    },
    ...moderationOverrides,
  };

  const handlers = new SocialHandlers({
    enabled,
    social,
    chatSettings: settings,
    recordAudit: async (input) => {
      audits.push(input);
    },
    moderation,
    clock: fixedClock(new Date("2026-07-30T10:00:00Z")),
    random: sequenceRandom(draws),
  });

  return { handlers, social, settings, audits, mutes };
};

const enable = async (
  harness: Harness,
  value: Record<string, unknown>,
): Promise<void> => {
  await harness.settings.setValue(TENANT, CHAT_ROW, SOCIAL_SETTINGS_KEY, value);
};

describe("SocialHandlers — interruptor maestro apagado", () => {
  /**
   * El estado por defecto en producción: el código desplegado y dormido.
   *
   * «Apagado» aquí significa MUDO, no «contesta que está apagado». Un grupo no
   * debe enterarse de que existe una función que todavía no se quiere ofrecer,
   * y un `null` deja que el resto del dispatch siga como si el comando no
   * estuviera registrado.
   */
  const off = () => makeHarness({}, [0], false);

  it("no contesta a NINGÚN comando social", async () => {
    const harness = off();
    // Encendido para el grupo y aun así mudo: el interruptor maestro manda.
    await enable(harness, {
      pole: { enabled: true },
      roulette: { enabled: true },
      fun: { pauloEnabled: true, catsEnabled: true, dogsEnabled: true },
      supportUrl: "https://modryva.example/apoyo",
    });

    for (const command of [
      "pole",
      "poles",
      "ruleta",
      "roulette",
      "paulo",
      "gato",
      "cat",
      "perro",
      "dog",
      "apoyar",
      "invitameauncafe",
    ]) {
      expect(
        await harness.handlers.handleCommand(context, update(command)),
        `/${command} debería callar`,
      ).toBeNull();
    }
    expect(
      await harness.handlers.handleCommand(
        context,
        update("status", ["social"]),
      ),
    ).toBeNull();
  });

  it("no toca la base de datos ni cuenta métricas", async () => {
    const harness = off();
    await enable(harness, { pole: { enabled: true } });
    await harness.handlers.handleCommand(context, update("pole"));
    // Ni una reclamación, ni una fila de auditoría.
    expect(harness.audits).toHaveLength(0);
  });

  it("la pole automática no mira los mensajes", async () => {
    const harness = off();
    await enable(harness, {
      pole: { enabled: true, mode: "AUTO_FIRST_MESSAGE" },
    });
    const plain = update("", [], {
      command: undefined,
      messageText: "buenos días",
    });
    expect(
      await harness.handlers.handleAmbientPole(
        context,
        plain,
        false,
        false,
        false,
      ),
    ).toBeNull();
  });

  it("encenderlo devuelve todo sin tocar nada más", async () => {
    // La prueba de que está dormido y no roto: el mismo grupo, el mismo
    // ajuste, y solo cambia el interruptor.
    const on = makeHarness({}, [0], true);
    await enable(on, { pole: { enabled: true } });
    const reply = await on.handlers.handleCommand(context, update("pole"));
    expect(reply?.text).toContain("🥇");
  });
});

describe("SocialHandlers — dispatch", () => {
  it("returns null for a command that is not ours", async () => {
    const { handlers } = makeHarness();
    expect(await handlers.handleCommand(context, update("ban"))).toBeNull();
  });

  it("leaves a plain /status to the core handler", async () => {
    // Only `/status social` is the social diagnostic; hijacking bare /status
    // would silently replace an existing screen.
    const { handlers } = makeHarness();
    expect(await handlers.handleCommand(context, update("status"))).toBeNull();
  });

  it("answers /status social with the diagnostic", async () => {
    const { handlers } = makeHarness();
    const reply = await handlers.handleCommand(
      context,
      update("status", ["social"]),
    );
    expect(reply?.text).toContain("Modryva Social — Estado");
    expect(reply?.text).toContain("Permisos:");
  });

  it("reports permissions as UNKNOWN when nothing probed them", async () => {
    // Never a green tick the bot did not earn.
    const { handlers } = makeHarness();
    const reply = await handlers.handleCommand(
      context,
      update("status", ["social"]),
    );
    expect(reply?.text).toContain("❔ Administrador del grupo");
  });
});

describe("SocialHandlers — /pole", () => {
  let harness: Harness;
  beforeEach(async () => {
    harness = makeHarness();
    await enable(harness, { pole: { enabled: true } });
  });

  it("says so when the pole is switched off", async () => {
    const off = makeHarness();
    const reply = await off.handlers.handleCommand(context, update("pole"));
    expect(reply?.text).toMatch(/no está activada/u);
  });

  it("awards the pole and records an audit row", async () => {
    const reply = await harness.handlers.handleCommand(context, update("pole"));
    expect(reply?.text).toContain("🥇");
    expect(reply?.text).toContain("Ana");

    const audit = harness.audits.find(
      (a) => a.action === "social.pole.claimed",
    );
    expect(audit?.payload?.position).toBe(1);
    // Ids, position and latency — never the text of the message.
    expect(JSON.stringify(audit?.payload)).not.toContain("/pole");
  });

  it("refuses a second claim from the same person", async () => {
    await harness.handlers.handleCommand(context, update("pole"));
    const again = await harness.handlers.handleCommand(context, update("pole"));
    expect(again?.text).toMatch(/ya (tienes|es tuyo)|Tu sitio/iu);
  });

  it("hands out silver and bronze to the next arrivals", async () => {
    await harness.handlers.handleCommand(context, update("pole"));
    const luis = update("pole", [], {
      user: {
        userId: 666n,
        username: "luis",
        firstName: "Luis",
        languageCode: "es",
      },
    });
    const second = await harness.handlers.handleCommand(context, luis);
    expect(second?.text).toContain("🥈");
  });

  it("closes the podium once the configured places are gone", async () => {
    await enable(harness, { pole: { enabled: true, positions: 1 } });
    await harness.handlers.handleCommand(context, update("pole"));
    const luis = update("pole", [], {
      user: {
        userId: 666n,
        username: "luis",
        firstName: "Luis",
        languageCode: "es",
      },
    });
    const second = await harness.handlers.handleCommand(context, luis);
    expect(second?.text).toMatch(/acabaron|repartido|tarde/iu);
  });

  it("refuses to run outside a group", async () => {
    const dm = update("pole", [], {
      chat: { chatId: 555n, chatType: "private", topicId: undefined },
    });
    const reply = await harness.handlers.handleCommand(context, dm);
    expect(reply?.text).toMatch(/en un grupo/u);
  });

  it("shows usage for a typo instead of spending the claim", async () => {
    const reply = await harness.handlers.handleCommand(
      context,
      update("pole", ["raking"]),
    );
    expect(reply?.text).toContain("Uso de /pole");
    // And the pole is still unclaimed.
    const claimed = await harness.handlers.handleCommand(
      context,
      update("pole"),
    );
    expect(claimed?.text).toContain("🥇");
  });

  it("answers the reports without data rather than crashing", async () => {
    for (const sub of ["hoy", "ranking", "racha", "records"]) {
      const reply = await harness.handlers.handleCommand(
        context,
        update("pole", [sub]),
      );
      expect(reply?.text.length).toBeGreaterThan(0);
    }
  });

  it("builds a ranking once there are claims", async () => {
    await harness.handlers.handleCommand(context, update("pole"));
    const reply = await harness.handlers.handleCommand(
      context,
      update("pole", ["ranking"]),
    );
    expect(reply?.text).toContain("Ana");
    expect(reply?.text).toContain("🥇1");
  });
});

describe("SocialHandlers — /ruleta", () => {
  const spinUpdate = update("ruleta");

  it("says so when the roulette is switched off", async () => {
    const harness = makeHarness();
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(reply?.text).toMatch(/no está activada/u);
  });

  it("survives a safe draw", async () => {
    // 1/6 with a draw of 5: safe.
    const harness = makeHarness({}, [5]);
    await enable(harness, { roulette: { enabled: true } });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(reply?.text).toContain("🔫");
    expect(harness.mutes).toHaveLength(0);
  });

  it("does nothing but joke on an adverse draw in FUN_ONLY", async () => {
    const harness = makeHarness({}, [0]);
    await enable(harness, { roulette: { enabled: true } });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(reply?.text).toContain("💥");
    expect(harness.mutes).toHaveLength(0);
  });

  it("mutes through the moderation port, never on its own", async () => {
    const harness = makeHarness({}, [0]);
    await enable(harness, {
      roulette: {
        enabled: true,
        consequence: "TEMPORARY_MUTE",
        muteSeconds: 300,
      },
    });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(harness.mutes).toEqual([{ userId: 555n, seconds: 300 }]);
    expect(reply?.text).toContain("5 minutos");
  });

  it("NEVER silences a protected account", async () => {
    const harness = makeHarness({ isProtected: async () => true }, [0]);
    await enable(harness, {
      roulette: { enabled: true, consequence: "TEMPORARY_MUTE" },
    });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(harness.mutes).toHaveLength(0);
    expect(reply?.text).toMatch(/administradores/u);
  });

  it("degrades honestly when the bot cannot restrict", async () => {
    const harness = makeHarness({ canRestrict: async () => false }, [0]);
    await enable(harness, {
      roulette: { enabled: true, consequence: "TEMPORARY_MUTE" },
    });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(harness.mutes).toHaveLength(0);
    expect(reply?.text).toMatch(/permiso/u);
    expect(reply?.text).toMatch(/status/u);
  });

  it("clamps a dangerous duration before anything is applied", async () => {
    // 5 s would be read by Telegram as a PERMANENT restriction.
    const harness = makeHarness({}, [0]);
    await enable(harness, {
      roulette: {
        enabled: true,
        consequence: "TEMPORARY_MUTE",
        muteSeconds: 5,
      },
    });
    await harness.handlers.handleCommand(context, spinUpdate);
    expect(harness.mutes[0]?.seconds).toBe(60);
  });

  it("stays silent on a redelivered message instead of playing twice", async () => {
    // Both cooldowns off ON PURPOSE. With them on, the replay is stopped by the
    // cooldown and this test would pass without ever exercising idempotency —
    // which is the thing that has to hold when Telegram redelivers minutes
    // later, or when claimUpdate reports "retry" after a crash.
    const harness = makeHarness({}, [0]);
    await enable(harness, {
      roulette: {
        enabled: true,
        consequence: "TEMPORARY_MUTE",
        userCooldownSeconds: 0,
        chatCooldownSeconds: 0,
      },
    });
    const first = await harness.handlers.handleCommand(context, spinUpdate);
    const replay = await harness.handlers.handleCommand(context, spinUpdate);
    expect(first?.text).toBeTruthy();
    expect(replay).toBeNull();
    // And, crucially, nobody was silenced twice for one command.
    expect(harness.mutes).toHaveLength(1);
  });

  it("contesta aunque el silencio reviente tras agotar los reintentos", async () => {
    // Telegram devuelve 429, el gateway reintenta y acaba lanzando. El comando
    // no puede quedarse sin respuesta: el grupo vería un /ruleta mudo.
    const harness = makeHarness(
      {
        mute: async () => {
          throw new Error("Telegram restrictChatMember failed with status 429");
        },
      },
      [0],
    );
    await enable(harness, {
      roulette: { enabled: true, consequence: "TEMPORARY_MUTE" },
    });
    const reply = await harness.handlers.handleCommand(context, spinUpdate);
    expect(reply?.text).toBeTruthy();
    expect(reply?.text).toMatch(/permiso/u);
  });

  it("un silencio fallido no se reintenta en la reentrega", async () => {
    // La ronda se registra ANTES de sancionar, así que aunque el mute fracase
    // el mensaje ya está reclamado: una reentrega no vuelve a intentarlo.
    let attempts = 0;
    const harness = makeHarness(
      {
        mute: async () => {
          attempts += 1;
          throw new Error("429");
        },
      },
      [0],
    );
    await enable(harness, {
      roulette: {
        enabled: true,
        consequence: "TEMPORARY_MUTE",
        userCooldownSeconds: 0,
        chatCooldownSeconds: 0,
      },
    });
    await harness.handlers.handleCommand(context, spinUpdate);
    await harness.handlers.handleCommand(context, spinUpdate);
    expect(attempts).toBe(1);
  });

  it("throttles a second spin from the same person", async () => {
    const harness = makeHarness({}, [5]);
    await enable(harness, { roulette: { enabled: true } });
    await harness.handlers.handleCommand(context, spinUpdate);
    const again = await harness.handlers.handleCommand(
      context,
      update("ruleta", [], { messageId: 901 }),
    );
    expect(again?.text).toMatch(/Espera|rápido/u);
  });

  it("never records the draw in the audit trail", async () => {
    const harness = makeHarness({}, [0]);
    await enable(harness, { roulette: { enabled: true } });
    await harness.handlers.handleCommand(context, spinUpdate);
    const audit = harness.audits.find(
      (a) => a.action === "social.roulette.round",
    );
    const payload = JSON.stringify(audit?.payload ?? {});
    // Probability yes, draw no: publishing the draw would let anyone work out
    // when the next round is safe.
    expect(payload).toContain("denominator");
    expect(payload).not.toContain("draw");
    expect(payload).not.toContain("seed");
  });

  it("offers no way to aim at somebody else", async () => {
    const harness = makeHarness({}, [0]);
    await enable(harness, {
      roulette: { enabled: true, consequence: "TEMPORARY_MUTE" },
    });
    const reply = await harness.handlers.handleCommand(
      context,
      update("ruleta", ["@otro"]),
    );
    expect(reply?.text).toContain("Uso de /ruleta");
    expect(harness.mutes).toHaveLength(0);
  });
});

describe("SocialHandlers — fun", () => {
  it("keeps /paulo quiet until a group enables it", async () => {
    const harness = makeHarness();
    const reply = await harness.handlers.handleCommand(
      context,
      update("paulo"),
    );
    expect(reply?.text).toMatch(/no está activado/u);
  });

  it("composes a sentence once enabled", async () => {
    const harness = makeHarness({}, [1, 2, 3]);
    await enable(harness, { fun: { pauloEnabled: true } });
    const reply = await harness.handlers.handleCommand(
      context,
      update("paulo", ["lunes"]),
    );
    expect(reply?.text.endsWith(".")).toBe(true);
    expect(reply?.text.length).toBeGreaterThan(20);
  });

  it("treats a mention as no topic rather than as a target", async () => {
    const harness = makeHarness({}, [0, 0, 0]);
    await enable(harness, { fun: { pauloEnabled: true } });
    const reply = await harness.handlers.handleCommand(
      context,
      update("paulo", ["@alguien"]),
    );
    expect(reply?.text).not.toContain("@alguien");
  });

  it("admits an empty library instead of failing silently", async () => {
    const harness = makeHarness();
    await enable(harness, { fun: { catsEnabled: true } });
    const reply = await harness.handlers.handleCommand(context, update("gato"));
    expect(reply?.text).toMatch(/biblioteca de gatos/u);
  });

  it("still admits it when the library has assets but no file_id for this bot", async () => {
    // A file_id belongs to the bot that uploaded it; a child bot cannot borrow
    // the parent's. Saying so beats sending nothing.
    const harness = makeHarness();
    await enable(harness, { fun: { catsEnabled: true } });
    harness.social.addAsset({
      id: "a1",
      tenantId: null,
      kind: "cat",
      source: "propia",
      licence: "CC0",
      attribution: null,
      storageKey: null,
      safetyStatus: "approved",
      active: true,
    });
    const reply = await harness.handlers.handleCommand(context, update("gato"));
    expect(reply?.text).toMatch(/biblioteca de gatos/u);
  });

  it("says nothing useful is configured for /apoyar rather than inventing a link", async () => {
    const harness = makeHarness();
    const reply = await harness.handlers.handleCommand(
      context,
      update("apoyar"),
    );
    expect(reply?.text).toMatch(/no hay ningún método/u);
  });

  it("uses the configured support link, and only an https one", async () => {
    const harness = makeHarness();
    await enable(harness, { supportUrl: "https://modryva.example/apoyo" });
    const reply = await harness.handlers.handleCommand(
      context,
      update("apoyar"),
    );
    expect(reply?.text).toContain("https://modryva.example/apoyo");

    await enable(harness, { supportUrl: "javascript:alert(1)" });
    const unsafe = await harness.handlers.handleCommand(
      context,
      update("apoyar"),
    );
    expect(unsafe?.text).not.toContain("javascript");
  });

  it("answers the alias /invitameauncafe the same way", async () => {
    const harness = makeHarness();
    await enable(harness, { supportUrl: "https://modryva.example/apoyo" });
    const reply = await harness.handlers.handleCommand(
      context,
      update("invitameauncafe"),
    );
    expect(reply?.text).toContain("https://modryva.example/apoyo");
  });
});

describe("SocialHandlers — automatic pole", () => {
  const plain = (over: Partial<TelegramUpdateEnvelope> = {}) =>
    update("", [], { command: undefined, messageText: "buenos días", ...over });

  it("does nothing unless the group chose automatic mode", async () => {
    const harness = makeHarness();
    await enable(harness, { pole: { enabled: true } });
    expect(
      await harness.handlers.handleAmbientPole(
        context,
        plain(),
        false,
        false,
        false,
      ),
    ).toBeNull();
  });

  it("awards the first eligible human message", async () => {
    const harness = makeHarness();
    await enable(harness, {
      pole: { enabled: true, mode: "AUTO_FIRST_MESSAGE" },
    });
    const reply = await harness.handlers.handleAmbientPole(
      context,
      plain(),
      false,
      false,
      false,
    );
    expect(reply?.text).toContain("🥇");
  });

  it("stays quiet for every message after the first", async () => {
    // Otherwise the bot answers three times every morning.
    const harness = makeHarness();
    await enable(harness, {
      pole: { enabled: true, mode: "AUTO_FIRST_MESSAGE" },
    });
    await harness.handlers.handleAmbientPole(
      context,
      plain(),
      false,
      false,
      false,
    );
    const second = await harness.handlers.handleAmbientPole(
      context,
      plain({
        user: {
          userId: 666n,
          username: "luis",
          firstName: "Luis",
          languageCode: "es",
        },
      }),
      false,
      false,
      false,
    );
    expect(second).toBeNull();
  });

  it("ignores bots, anonymous admins and edits", async () => {
    const harness = makeHarness();
    await enable(harness, {
      pole: { enabled: true, mode: "AUTO_FIRST_MESSAGE" },
    });
    expect(
      await harness.handlers.handleAmbientPole(
        context,
        plain(),
        false,
        true,
        false,
      ),
    ).toBeNull();
    expect(
      await harness.handlers.handleAmbientPole(
        context,
        plain(),
        false,
        false,
        true,
      ),
    ).toBeNull();
    expect(
      await harness.handlers.handleAmbientPole(
        context,
        plain(),
        true,
        false,
        false,
      ),
    ).toBeNull();
    // ...and the pole is still there for a real person afterwards.
    const reply = await harness.handlers.handleAmbientPole(
      context,
      plain(),
      false,
      false,
      false,
    );
    expect(reply?.text).toContain("🥇");
  });
});

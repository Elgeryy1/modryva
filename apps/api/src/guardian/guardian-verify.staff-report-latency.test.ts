import {
  type GuardianSettingsState,
  InMemoryGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import { GuardianVerifyService } from "./guardian-verify.service.js";

/**
 * Cuánto espera la persona por papeleo que no es suyo.
 *
 * Cuando se manda el informe a STAFF, Telegram YA ha admitido o rechazado a
 * quien se verificó: lo que queda es avisar a los administradores. Aun así se
 * hacía todo en fila dentro de su petición — el grupo, la reputación de la IP
 * (petición a un tercero con 3 s de tope), los vecinos de IP, y luego una
 * subida entera de la foto por cada sala espejo.
 *
 * En producción `attempt/submit` llegó a 17,6 s con el análisis de IA costando
 * 3,3 s de mediana. El resto era esto. Y no es gratis: hay gente tocando el
 * botón dos veces a los 3 s porque la pantalla parece muerta.
 *
 * Estas pruebas no miden tiempo — medir tiempo es frágil. Usan una puerta que
 * solo se abre cuando han llegado N llamadas a la vez: si el código vuelve a
 * ponerlas en fila, la primera se queda esperando a las que nunca llegan y la
 * prueba falla por plantón, que es exactamente lo que se quiere detectar.
 */

/**
 * Una puerta que se abre cuando `esperados` llamadas están dentro a la vez.
 * En serie no se abre nunca (y la prueba revienta por tiempo); en paralelo se
 * abre y todas siguen.
 */
const puertaDe = (esperados: number) => {
  let llegados = 0;
  let abrir: () => void = () => undefined;
  const abierta = new Promise<void>((resolve) => {
    abrir = resolve;
  });
  return {
    llegadas: () => llegados,
    cruzar: async (): Promise<void> => {
      llegados += 1;
      if (llegados >= esperados) {
        abrir();
      }
      await abierta;
    },
  };
};

const settings = (
  extraStaffChats: { chatId: string; threadId: number | null }[] = [],
): GuardianSettingsState =>
  ({
    staffChatId: -1001n,
    staffThreadId: null,
    extraStaffChats,
    protectStaffContent: false,
    keepStaffPhotos: false,
    mediaRetentionHours: 72,
    locale: "es",
  }) as unknown as GuardianSettingsState;

const nuevaSesion = async (
  repo: InMemoryGuardianRepository,
): Promise<VerificationSessionRecord> => {
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100n,
    telegramUserId: 42n,
    mode: "manual",
    challengeDefinition: { steps: [] },
    challengeNonce: `nonce-${Math.random()}`,
    sessionTokenHash: `hash-${Math.random()}`,
    expiresAt: new Date(Date.now() + 600_000),
    idempotencyKey: `idem-${Math.random()}`,
  });
  if (!session) {
    throw new Error("fixture: la sesion no se creo");
  }
  return session;
};

const informar = async (
  service: GuardianVerifyService,
  session: VerificationSessionRecord,
  state: GuardianSettingsState,
  tokenYaResuelto?: string,
): Promise<void> => {
  await (
    service as unknown as {
      sendStaffReport: (
        s: VerificationSessionRecord,
        set: GuardianSettingsState,
        decision: string,
        reason: string,
        signals: unknown,
        extras?: unknown,
        token?: string,
      ) => Promise<void>;
    }
  ).sendStaffReport(
    session,
    state,
    "manual_review",
    "needs_human",
    {},
    {},
    tokenYaResuelto,
  );
};

describe("el informe a STAFF no se hace en fila", () => {
  it("el grupo y los vecinos de IP se consultan a la vez", async () => {
    // Dos lecturas independientes que antes iban una detrás de otra.
    const puerta = puertaDe(2);
    const repo = new InMemoryGuardianRepository();
    const session = await nuevaSesion(repo);

    repo.listIpNeighbours = async () => {
      await puerta.cruzar();
      return [];
    };

    const service = new GuardianVerifyService({
      repo,
      gateway: {
        sendMessage: async () => ({ ok: true, skipped: false, messageId: 1 }),
        sendPhoto: async () => ({ ok: true, skipped: false, messageId: 1 }),
      },
      sessionSecret: "s3cret",
      primaryToken: "bot:token",
      managedBotTokenKey: "k",
      ipIntelEnabled: false,
      foundation: {
        findChatByTelegramId: async () => {
          await puerta.cruzar();
          return { chatId: "c1", title: "Grupo" };
        },
        recordAudit: async () => undefined,
      },
    } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);

    await informar(
      service,
      { ...session, verifierIp: "203.0.113.7" },
      settings(),
      "bot:token",
    );

    expect(puerta.llegadas()).toBe(2);
  });

  it("las salas espejo reciben la copia a la vez, no una detras de otra", async () => {
    // Cada espejo sube la MISMA foto entera. En fila, el coste se multiplicaba
    // por el numero de salas con la persona esperando.
    const puerta = puertaDe(3);
    const repo = new InMemoryGuardianRepository();
    const session = await nuevaSesion(repo);
    const espejos = new Set(["-2001", "-2002", "-2003"]);

    const enviar = async (input: { chatId: bigint }) => {
      if (espejos.has(input.chatId.toString())) {
        await puerta.cruzar();
      }
      return { ok: true, skipped: false, messageId: 7 };
    };

    const service = new GuardianVerifyService({
      repo,
      gateway: { sendMessage: enviar, sendPhoto: enviar },
      sessionSecret: "s3cret",
      primaryToken: "bot:token",
      managedBotTokenKey: "k",
      ipIntelEnabled: false,
      foundation: {
        findChatByTelegramId: async () => ({ chatId: "c1", title: "Grupo" }),
        recordAudit: async () => undefined,
      },
    } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);

    await informar(
      service,
      session,
      settings([
        { chatId: "-2001", threadId: null },
        { chatId: "-2002", threadId: null },
        { chatId: "-2003", threadId: null },
      ]),
      "bot:token",
    );

    expect(puerta.llegadas()).toBe(3);
  });
});

describe("el informe sale de la petición de la persona", () => {
  /** Monta el servicio con un gateway que se queda colgado para siempre en el
   * envío a STAFF, y devuelve también las filas de auditoría escritas. */
  const servicioColgado = (repo: InMemoryGuardianRepository) => {
    const auditorias: string[] = [];
    let envios = 0;
    const colgado = async () => {
      envios += 1;
      await new Promise<never>(() => undefined); // nunca resuelve
      throw new Error("inalcanzable");
    };
    const service = new GuardianVerifyService({
      repo,
      gateway: {
        sendMessage: colgado,
        sendPhoto: colgado,
        approveChatJoinRequest: async () => ({ ok: true }),
        declineChatJoinRequest: async () => ({ ok: true }),
        answerChatJoinRequestQuery: async () => ({ ok: true, skipped: false }),
      },
      sessionSecret: "s3cret",
      primaryToken: "bot:token",
      managedBotTokenKey: "k",
      ipIntelEnabled: false,
      foundation: {
        findChatByTelegramId: async () => ({ chatId: "c1", title: "Grupo" }),
        recordAudit: async (fila: { action: string }) => {
          auditorias.push(fila.action);
        },
      },
    } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);
    return { service, auditorias, envios: () => envios };
  };

  it("la persona recibe respuesta aunque el envío a STAFF se quede colgado", async () => {
    // Este es el cambio entero. Si `resolveWithDecision` volviera a esperar el
    // informe, este test no falla con un mensaje bonito: se queda colgado, que
    // es justo lo que le pasaba a la persona mirando la pantalla.
    const repo = new InMemoryGuardianRepository();
    const session = await nuevaSesion(repo);
    const { service, auditorias } = servicioColgado(repo);

    const privado = service as unknown as {
      resolveWithDecision: (
        s: VerificationSessionRecord,
        set: GuardianSettingsState,
        input: unknown,
      ) => Promise<{ outcome: string }>;
      toDecisionSettings: (set: GuardianSettingsState, mode: string) => unknown;
      emptySignals: (b: boolean, c: unknown) => unknown;
    };
    const state = settings();

    const resultado = await privado.resolveWithDecision(session, state, {
      settings: privado.toDecisionSettings(state, session.mode),
      attemptsRemaining: 0,
      integrityViolation: null,
      pipelineError: true,
      signals: privado.emptySignals(false, null),
    });

    expect(resultado.outcome).toBe("resolved");
    // Y el informe quedó en marcha, con constancia de que empezó: sin esa fila,
    // un proceso que muera aquí se lleva el informe sin dejar rastro.
    expect(auditorias).toContain("guardian.staff_report_started");
  });

  it("un fallo inesperado del informe no tumba el proceso", async () => {
    // Sin `await`, una promesa rechazada y sin dueño se lleva Node por delante.
    // Tumbar el api entero por un informe es peor que el informe perdido.
    const repo = new InMemoryGuardianRepository();
    const session = await nuevaSesion(repo);
    const service = new GuardianVerifyService({
      repo,
      gateway: {
        sendMessage: async () => {
          throw new Error("boom inesperado");
        },
        sendPhoto: async () => {
          throw new Error("boom inesperado");
        },
      },
      sessionSecret: "s3cret",
      primaryToken: "bot:token",
      managedBotTokenKey: "k",
      ipIntelEnabled: false,
      foundation: {
        findChatByTelegramId: async () => {
          throw new Error("hasta la auditoría falla");
        },
        recordAudit: async () => {
          throw new Error("y la auditoría también");
        },
      },
    } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);

    await expect(
      (
        service as unknown as {
          enviarInformeAparte: (
            s: VerificationSessionRecord,
            set: GuardianSettingsState,
            d: string,
            r: string,
            sig: unknown,
            extras: unknown,
            token: string,
          ) => Promise<void>;
        }
      ).enviarInformeAparte(
        session,
        settings(),
        "manual_review",
        "needs_human",
        {},
        {},
        "bot:token",
      ),
    ).resolves.toBeUndefined();
  });
});

describe("el token del bot se pide una vez, no dos", () => {
  it("no se vuelve a resolver cuando quien llama ya lo tiene", async () => {
    // `resolveWithDecision` acaba de resolverlo para admitir a la persona.
    // Volver a pedirlo era la misma consulta a la misma tabla, por verificacion.
    const repo = new InMemoryGuardianRepository();
    const session = await nuevaSesion(repo);
    let veces = 0;

    repo.resolveBotTokenForTenant = async () => {
      veces += 1;
      return "bot:token";
    };

    const service = new GuardianVerifyService({
      repo,
      gateway: {
        sendMessage: async () => ({ ok: true, skipped: false, messageId: 1 }),
        sendPhoto: async () => ({ ok: true, skipped: false, messageId: 1 }),
      },
      sessionSecret: "s3cret",
      primaryToken: "bot:token",
      managedBotTokenKey: "k",
      ipIntelEnabled: false,
      foundation: {
        findChatByTelegramId: async () => ({ chatId: "c1", title: "Grupo" }),
        recordAudit: async () => undefined,
      },
    } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);

    await informar(service, session, settings(), "bot:token");
    expect(veces).toBe(0);

    // Y sigue valiendo por si sola: sin token, lo resuelve.
    await informar(service, session, settings());
    expect(veces).toBe(1);
  });
});

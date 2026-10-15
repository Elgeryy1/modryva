import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import { GuardianConfigController } from "./guardian-config.controller.js";
import type { MiniappRequest } from "./init-data.guard.js";

/**
 * Lo que se prueba aquí es que un chat STAFF al que el bot NO llega sea un
 * dato del diagnóstico y no una excepción.
 *
 * El 2026-09-11, configurando Guardian en un grupo, el chat STAFF quedó
 * apuntando a un id que no existía —el número en positivo, sin el `-100`— y la
 * pantalla de ajustes solo sabía decir "http-500". El fallo real (`getChat`
 * contesta 400 y el gateway lo convierte en excepción) se llevaba por delante
 * el diagnóstico entero, así que la única comprobación que tenía la respuesta
 * era justo la que reventaba. Mientras tanto, las verificaciones salían bien y
 * sus expedientes no llegaban a ningún sitio.
 */

const GRUPO = "-1009000000002";
const STAFF_BUENO = "-1009000000003";
const STAFF_INALCANZABLE = "9000000099";

const CHAT = {
  tenantId: "t1",
  chatId: "c1",
  telegramChatId: GRUPO,
  title: "Grupo Pruebas",
};

const admin = {
  assertGroupAdmin: async () => {},
  assertCanChangeSettings: async () => {},
  resolveChat: async () => CHAT,
} as unknown as MiniappAdminService;

const peticion = (): MiniappRequest => ({
  headers: {},
  miniapp: {
    userId: "1",
    user: {},
    startParam: null,
    botUsername: "modryvabot",
    botToken: "123:abc",
  },
});

/**
 * Un gateway que solo conoce los chats que se le pasan. Para el resto imita lo
 * que hace el de verdad ante un 400 de Telegram: LANZA. Ese detalle es el
 * fichero entero — un doble que devolviera `ok: false` no probaría nada.
 */
const gatewayCon = (alcanzables: readonly string[]) => {
  const vistos: string[] = [];
  return {
    vistos,
    getMe: async () => ({
      ok: true,
      skipped: false,
      botUserId: 42,
      supportsJoinRequestQueries: true,
    }),
    getChatMember: async () => ({
      ok: true,
      skipped: false,
      status: "administrator",
    }),
    getChat: async ({ chatId }: { chatId: bigint }) => {
      vistos.push(chatId.toString());
      if (!alcanzables.includes(chatId.toString())) {
        throw new Error("Telegram getChat failed with status 400");
      }
      return {
        ok: true,
        skipped: false,
        chat: { chatId, type: "supergroup" },
      };
    },
  };
};

const AJUSTES = {
  enabled: true,
  mode: "manual",
  staffChatId: null as bigint | null,
  staffThreadId: null,
  extraStaffChats: [],
  captureMode: "video_with_fallback",
  challengeDifficulty: "normal",
  enabledChallenges: null,
  maxAttempts: 3,
  sessionTtlSeconds: 600,
  mediaRetentionHours: 72,
  autoApproveThreshold: 0.85,
  manualReviewThreshold: 0.55,
  livenessMinimum: 0.6,
  gestureMinimum: 0.6,
  replayRiskMaximum: 0.4,
  syntheticRiskMaximum: 0.4,
  requireSingleFace: true,
  estimateAge: false,
  minimumAge: null,
  maximumAge: null,
  requiredPhotos: 1,
  allowedCountries: [],
  allowAutomaticDecline: false,
  sendApprovedCasesToStaff: true,
  protectStaffContent: true,
  keepStaffPhotos: false,
  declineOnExpiry: false,
  locale: "es",
};

const CUERPO = {
  ...AJUSTES,
  staffChatId: STAFF_INALCANZABLE,
  extraStaffChats: [],
};

const montar = (staffChatId: bigint | null, alcanzables: readonly string[]) => {
  const gateway = gatewayCon(alcanzables);
  const guardado: { staffChatId?: bigint | null } = {};
  const controlador = new GuardianConfigController(admin);
  Object.assign(controlador, {
    gateway,
    guardian: {
      getSettings: async () => ({ ...AJUSTES, staffChatId }),
      upsertSettings: async (
        _tenantId: string,
        _chatId: string,
        datos: { staffChatId: bigint | null },
      ) => {
        guardado.staffChatId = datos.staffChatId;
        return { ...AJUSTES, staffChatId: datos.staffChatId };
      },
    },
    foundation: { recordAudit: async () => {} },
  });
  return { controlador, gateway, guardado };
};

describe("GuardianConfigController: diagnóstico", () => {
  it("un chat STAFF inalcanzable es un dato, no un 500", async () => {
    const { controlador } = montar(BigInt(STAFF_INALCANZABLE), [GRUPO]);

    const resultado = await controlador.diagnostics(peticion(), GRUPO);

    expect(resultado.staffChatConfigured).toBe(true);
    expect(resultado.staffChatReachable).toBe(false);
  });

  it("lo dice cuando el bot sí llega", async () => {
    const { controlador } = montar(BigInt(STAFF_BUENO), [GRUPO, STAFF_BUENO]);

    const resultado = await controlador.diagnostics(peticion(), GRUPO);

    expect(resultado.staffChatReachable).toBe(true);
  });

  it("sin chat STAFF no le pregunta nada a Telegram", async () => {
    const { controlador, gateway } = montar(null, [GRUPO]);

    const resultado = await controlador.diagnostics(peticion(), GRUPO);

    expect(resultado.staffChatConfigured).toBe(false);
    expect(resultado.staffChatReachable).toBeNull();
    expect(gateway.vistos).toEqual([GRUPO]);
  });

  it("el resto del diagnóstico sigue contestando con el staff roto", async () => {
    const { controlador } = montar(BigInt(STAFF_INALCANZABLE), [GRUPO]);

    const resultado = await controlador.diagnostics(peticion(), GRUPO);

    // Lo que hacía el 500: perder TODO lo demás por una comprobación.
    expect(resultado.botIsAdmin).toBe(true);
    expect(resultado.sessionSecretConfigured).toBeDefined();
  });
});

describe("GuardianConfigController: guardar", () => {
  it("avisa cuando el bot no llega al chat STAFF, pero guarda igual", async () => {
    const { controlador, guardado } = montar(null, [GRUPO]);

    const resultado = await controlador.updateSettings(
      peticion(),
      GRUPO,
      CUERPO,
    );

    expect(resultado.warnings.map((w) => w.code)).toContain("unreachable");
    // Guardar NO se bloquea: si Telegram falla, los ajustes tienen que poder
    // escribirse igual. El aviso informa; no es una puerta.
    expect(guardado.staffChatId).toBe(BigInt(STAFF_INALCANZABLE));
  });

  it("no avisa de nada cuando el chat STAFF es bueno", async () => {
    const { controlador } = montar(null, [GRUPO, STAFF_BUENO]);

    const resultado = await controlador.updateSettings(peticion(), GRUPO, {
      ...CUERPO,
      staffChatId: STAFF_BUENO,
    });

    expect(resultado.warnings.map((w) => w.code)).not.toContain("unreachable");
  });
});

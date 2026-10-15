import {
  InMemoryGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import { encryptJoinRequestQueryId } from "@superbot/module-guardian";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El paso que admite a la persona en el grupo, y —sobre todo— cómo se cuenta
 * cuando Telegram dice que no.
 *
 * En 40 h de producción este bloque escribió 27 líneas de nivel ERROR diciendo
 * "person NOT admitted/rejected". Las 27 personas estaban dentro del grupo: la
 * base de datos las tenía como `auto_approve|resolved` y Telegram respondía
 * `USER_ALREADY_PARTICIPANT` justo porque ya habían entrado.
 *
 * Lo que se fija aquí no es el texto del log, es el NIVEL. Es lo único que
 * separa una alarma de un adorno, y una alarma que se dispara 27 veces al día
 * sin motivo deja de mirarla nadie — incluido el día que sea verdad.
 */

const { anotado } = vi.hoisted(() => ({
  anotado: [] as { level: string; msg: string }[],
}));

vi.mock("@superbot/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@superbot/shared")>();
  const apunta =
    (level: string) =>
    (_detalle: unknown, msg?: string): void => {
      anotado.push({ level, msg: msg ?? String(_detalle) });
    };
  return {
    ...actual,
    createLogger: () => ({
      debug: apunta("debug"),
      info: apunta("info"),
      warn: apunta("warn"),
      error: apunta("error"),
      fatal: apunta("fatal"),
      trace: apunta("trace"),
    }),
  };
});

// El `vi.mock` de arriba se iza por encima de los imports, así que este llega
// ya con el logger falso puesto.
const { GuardianVerifyService } = await import("./guardian-verify.service.js");

const SECRET = "s3cret-de-pruebas-que-no-vale-nada";

const falloTelegram = (descripcion: string) =>
  new Error(
    `Telegram approveChatJoinRequest failed with status 400: Bad Request: ${descripcion}`,
  );

/**
 * Un gateway que falla el paso 2 (la admisión) y responde lo que se le diga al
 * paso 1 (la respuesta a la query del Mini App).
 */
const gatewayQue = (options: {
  admisionFalla: Error;
  queryResponde?: "ok" | "ko" | "explota";
}) => {
  const llamadas: string[] = [];
  return {
    llamadas,
    gateway: {
      answerChatJoinRequestQuery: async () => {
        llamadas.push("query");
        if (options.queryResponde === "explota") {
          throw new Error(
            "Telegram answerChatJoinRequestQuery failed: QUERY_ID_INVALID",
          );
        }
        return { ok: options.queryResponde === "ok", skipped: false };
      },
      approveChatJoinRequest: async () => {
        llamadas.push("approve");
        throw options.admisionFalla;
      },
      declineChatJoinRequest: async () => {
        llamadas.push("decline");
        throw options.admisionFalla;
      },
    },
  };
};

const nuevaSesion = async (
  repo: InMemoryGuardianRepository,
  conQueryId: boolean,
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
    ...(conQueryId
      ? {
          joinRequestQueryIdEncrypted: encryptJoinRequestQueryId(
            "query-abc",
            SECRET,
          ),
        }
      : {}),
  });
  if (!session) {
    throw new Error("fixture: la sesion no se creo");
  }
  return session;
};

/** `answerTelegram` es privado; esto lo ejercita como lo llama el servicio de
 * verdad, sin fingir que es API publica. */
const admitir = async (
  service: unknown,
  session: VerificationSessionRecord,
  decision: string,
): Promise<void> => {
  await (
    service as {
      answerTelegram: (
        s: VerificationSessionRecord,
        d: string,
        t: string | undefined,
      ) => Promise<void>;
    }
  ).answerTelegram(session, decision, "bot:token");
};

const servicio = (repo: InMemoryGuardianRepository, gateway: unknown) =>
  new GuardianVerifyService({
    repo,
    gateway,
    sessionSecret: SECRET,
    primaryToken: "bot:token",
    managedBotTokenKey: "k",
  } as unknown as ConstructorParameters<typeof GuardianVerifyService>[0]);

let repo: InMemoryGuardianRepository;
beforeEach(() => {
  anotado.length = 0;
  repo = new InMemoryGuardianRepository();
});

const nivelesDe = (): string[] => anotado.map((l) => l.level);

describe("los 27 ERROR que decian una mentira", () => {
  it("aprobar a quien YA estaba dentro no es un error", async () => {
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("USER_ALREADY_PARTICIPANT"),
    });
    const session = await nuevaSesion(repo, false);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(nivelesDe()).not.toContain("error");
    expect(nivelesDe()).not.toContain("warn");
  });

  it("y el texto ya no afirma que la persona se quedo fuera", async () => {
    // Lo que hacia dano no era el nivel solo: el mensaje afirmaba lo contrario
    // de lo que habia pasado, asi que quien lo leyera salia peor informado que
    // si no hubiera leido nada.
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("USER_ALREADY_PARTICIPANT"),
    });
    const session = await nuevaSesion(repo, false);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    for (const linea of anotado) {
      expect(linea.msg).not.toContain("NOT admitted");
    }
  });
});

describe("lo que si tiene que seguir gritando", () => {
  it("un fallo de permisos sigue siendo ERROR", async () => {
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("not enough rights"),
    });
    const session = await nuevaSesion(repo, false);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(nivelesDe()).toContain("error");
  });

  it("rechazar a alguien que resulta estar DENTRO sigue siendo ERROR", async () => {
    // El caso espejo, y el mas peligroso de silenciar: pedimos que no entrara
    // y esta dentro. Si el filtro mirase solo el texto de Telegram, este se
    // colaria por benigno junto con el de arriba.
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("USER_ALREADY_PARTICIPANT"),
    });
    const session = await nuevaSesion(repo, false);

    await admitir(servicio(repo, gateway), session, "auto_decline");

    expect(nivelesDe()).toContain("error");
  });

  it("una solicitud que ya no esta, y que no resolvimos nosotros, avisa", async () => {
    // No es culpa nuestra, pero la persona pudo quedarse fuera: ni ERROR ni
    // silencio.
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("HIDE_REQUESTER_MISSING"),
    });
    const session = await nuevaSesion(repo, false);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(nivelesDe()).toContain("warn");
    expect(nivelesDe()).not.toContain("error");
  });
});

describe("cuando el paso 1 ya habia resuelto la solicitud", () => {
  it("que el paso 2 diga 'ya no esta' deja de ser noticia", async () => {
    // Responder la query del Mini App YA admite a la persona. Que la llamada
    // de despues encuentre la solicitud vacia es la consecuencia, no un aviso.
    const { gateway, llamadas } = gatewayQue({
      admisionFalla: falloTelegram("HIDE_REQUESTER_MISSING"),
      queryResponde: "ok",
    });
    const session = await nuevaSesion(repo, true);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(llamadas).toEqual(["query", "approve"]);
    expect(nivelesDe()).not.toContain("warn");
    expect(nivelesDe()).not.toContain("error");
  });

  it("pero si el paso 1 fallo, el aviso vuelve", async () => {
    // La red de seguridad tiene que seguir siendo red: si nadie resolvio la
    // solicitud y ya no esta, eso hay que verlo.
    const { gateway } = gatewayQue({
      admisionFalla: falloTelegram("HIDE_REQUESTER_MISSING"),
      queryResponde: "explota",
    });
    const session = await nuevaSesion(repo, true);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(nivelesDe()).toContain("warn");
  });
});

describe("la red de seguridad sigue puesta", () => {
  it("el paso 2 se intenta aunque el paso 1 haya ido bien", async () => {
    // El bug que existia antes: la admision colgaba del query_id, asi que un
    // reintento sin el grababa "aprobado" y dejaba a la persona fuera.
    const { gateway, llamadas } = gatewayQue({
      admisionFalla: falloTelegram("USER_ALREADY_PARTICIPANT"),
      queryResponde: "ok",
    });
    const session = await nuevaSesion(repo, true);

    await admitir(servicio(repo, gateway), session, "auto_approve");

    expect(llamadas).toContain("approve");
  });

  it("manual_review no admite ni rechaza a nadie", async () => {
    const { gateway, llamadas } = gatewayQue({
      admisionFalla: falloTelegram("USER_ALREADY_PARTICIPANT"),
      queryResponde: "ok",
    });
    const session = await nuevaSesion(repo, true);

    await admitir(servicio(repo, gateway), session, "manual_review");

    expect(llamadas).toEqual(["query"]);
  });
});

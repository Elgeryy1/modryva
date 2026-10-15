import { InMemoryGuardianRepository } from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type GuardianRequest,
  GuardianSessionGuard,
  resolveClientIp,
} from "./guardian-session.guard.js";

describe("resolveClientIp", () => {
  it("prefers the custom x-modryva-ip header (set by the CF Transform Rule)", () => {
    expect(
      resolveClientIp({
        "x-modryva-ip": "9.9.9.9",
        "cf-connecting-ip": "1.1.1.1",
      }),
    ).toBe("9.9.9.9");
  });

  it("prefers cf-connecting-ip when the custom header is absent", () => {
    expect(
      resolveClientIp({
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "2.2.2.2",
      }),
    ).toBe("1.1.1.1");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    expect(resolveClientIp({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" })).toBe(
      "3.3.3.3",
    );
  });

  it("falls back to true-client-ip then x-real-ip", () => {
    expect(resolveClientIp({ "true-client-ip": "5.5.5.5" })).toBe("5.5.5.5");
    expect(resolveClientIp({ "x-real-ip": "6.6.6.6" })).toBe("6.6.6.6");
  });

  it("returns undefined when no IP header is present", () => {
    expect(resolveClientIp({})).toBeUndefined();
  });
});

const RAW_SESSION_TOKEN = "raw-token";

/**
 * Covers ONLY the dev-only test bypass (GUARDIAN_TEST_MODE) — the real
 * initData path needs a live bot-token/HMAC chain this suite doesn't stand
 * up. The bypass is the newer, safety-critical piece: it must be
 * unreachable unless THREE independent things are all true at once.
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.GUARDIAN_TEST_MODE = "1";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

/** NestJS HttpExceptions built with an object body (as this guard does) keep
 * that body in `.getResponse()`, not `.message` — asserting against
 * `.message` would only ever see the generic HTTP status text. */
const expectRejectsWithError = async (
  promise: Promise<unknown>,
  expectedError: string,
): Promise<void> => {
  let caught: { getResponse: () => { error?: string } } | undefined;
  try {
    await promise;
  } catch (err) {
    caught = err as { getResponse: () => { error?: string } };
  }
  expect(caught).toBeDefined();
  expect(caught?.getResponse().error).toBe(expectedError);
};

const fakeExecutionContext = (
  headers: Record<string, string>,
): { switchToHttp: () => { getRequest: () => GuardianRequest } } => {
  const request: GuardianRequest = { headers };
  return { switchToHttp: () => ({ getRequest: () => request }) };
};

const buildGuardWithSession = async (telegramUserId: bigint) => {
  const repo = new InMemoryGuardianRepository();
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100123n,
    telegramUserId,
    mode: "auto",
    challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
    challengeNonce: "n",
    sessionTokenHash: hashSessionToken(RAW_SESSION_TOKEN),
    expiresAt: new Date(Date.now() + 60_000),
    idempotencyKey: "idem-1",
  });
  const guard = new GuardianSessionGuard();
  // The guard self-constructs a real PrismaGuardianRepository — swap it for
  // the in-memory test double, mirroring how other test suites in this repo
  // exploit constructor-time instantiation for test-friendliness.
  // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
  (guard as any).guardian = repo;
  return { guard, session };
};

describe("GuardianSessionGuard — dev test bypass", () => {
  it("authenticates via X-Guardian-Test-User when all three gates are satisfied", async () => {
    const { guard, session } = await buildGuardWithSession(555n);
    expect(session).not.toBeNull();

    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    const allowed = await guard.canActivate(context as any);
    expect(allowed).toBe(true);
  });

  it("rejects when the test-user header doesn't match the session's real user", async () => {
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "999",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    await expect(guard.canActivate(context as any)).rejects.toThrow();
  });

  it("never activates the bypass without the explicit X-Guardian-Test-Bypass header, even in test mode", async () => {
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-user": "555",
      // no x-guardian-test-bypass header at all
    });
    // Falls through to requiring real initData, which is absent here.
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("never activates the bypass when GUARDIAN_TEST_MODE is off, even with the header set", async () => {
    process.env.GUARDIAN_TEST_MODE = "0";
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("never activates the bypass when NODE_ENV is production, even with GUARDIAN_TEST_MODE=1", async () => {
    process.env.NODE_ENV = "production";
    // Guardian OFF, so this isolates the GUARD's own check. There are two
    // defences against a production bypass and they fire in order: with
    // Guardian enabled the env schema rejects this exact combination and
    // getRuntimeEnv throws before the guard decides anything — the stronger
    // one, already covered in env.test.ts. Leaving it ambient made this test
    // pass or fail on whichever .env the run happened to load, which is how a
    // permanently red test teaches everyone to ignore red.
    process.env.GUARDIAN_ENABLED = "0";
    const { guard } = await buildGuardWithSession(555n);
    const context = fakeExecutionContext({
      "x-guardian-session": "raw-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "missing-auth",
    );
  });

  it("still enforces session-not-found even when test mode is on", async () => {
    const repo = new InMemoryGuardianRepository();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    const context = fakeExecutionContext({
      "x-guardian-session": "no-such-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "session-not-found",
    );
  });
});

describe("GuardianSessionGuard — caducada vs cerrada", () => {
  /** Una sesión viva a la que se le sella un estado terminal, como hace el
   * barrido del worker (expired) o una re-solicitud (cancelled). */
  const conEstado = async (
    estado: "expired" | "cancelled" | "resolved",
    opciones: {
      vencida?: boolean;
      decision?: "auto_approve" | "auto_decline" | "manual_review";
      accionesDeStaff?: readonly ("approve" | "decline" | "retry")[];
    } = {},
  ) => {
    const repo = new InMemoryGuardianRepository();
    const session = await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100123n,
      telegramUserId: 555n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken(RAW_SESSION_TOKEN),
      expiresAt: new Date(
        Date.now() + (opciones.vencida === true ? -60_000 : 60_000),
      ),
      idempotencyKey: "idem-1",
    });
    if (!session) {
      throw new Error("la sesión de partida no se creó");
    }
    await repo.resolveSession(session.id, session.version, {
      status: estado,
      ...(opciones.decision ? { decision: opciones.decision } : {}),
    });
    for (const action of opciones.accionesDeStaff ?? []) {
      await repo.createStaffDecision({
        sessionId: session.id,
        moderatorTelegramId: 999n,
        action,
      });
    }
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    return guard;
  };

  const contexto = fakeExecutionContext({
    "x-guardian-session": RAW_SESSION_TOKEN,
    "x-guardian-test-bypass": "1",
    "x-guardian-test-user": "555",
  });

  // El caso que mandaba a la gente a "esta verificación ya se completó o fue
  // cancelada" sin haber completado ni cancelado nada: el barrido del worker
  // sella `expired` al minuto de vencer el plazo, y el estado se miraba antes
  // que la fecha.
  it("dice session-expired cuando el barrido ya selló la sesión como expired", async () => {
    const guard = await conEstado("expired", { vencida: true });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(contexto as any),
      "session-expired",
    );
  });

  // El minuto que va del vencimiento al barrido: sigue `pending` y el plazo ya
  // se la llevó. Mismo desenlace, para que las dos formas de caducar no se
  // cuenten en montones distintos.
  it("dice session-expired cuando el plazo venció y el barrido aún no ha pasado", async () => {
    const repo = new InMemoryGuardianRepository();
    await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100123n,
      telegramUserId: 555n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken(RAW_SESSION_TOKEN),
      expiresAt: new Date(Date.now() - 60_000),
      idempotencyKey: "idem-1",
    });
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(contexto as any),
      "session-expired",
    );
  });

  it("reserva session-not-active para lo que de verdad se cerró", async () => {
    for (const estado of ["cancelled", "resolved"] as const) {
      const guard = await conEstado(estado);
      await expectRejectsWithError(
        // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
        guard.canActivate(contexto as any),
        "session-not-active",
      );
    }
  });

  // Una sesión cerrada DENTRO de plazo no puede acabar en la pantalla de
  // caducado por el hecho de que el plazo venza después: quien la completó no
  // tiene que volver a pedir entrar.
  it("sigue diciendo session-not-active en una sesión resuelta cuyo plazo ya pasó", async () => {
    const guard = await conEstado("resolved", { vencida: true });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(contexto as any),
      "session-not-active",
    );
  });

  /**
   * El 410 sigue siendo un 410 —aquí no se deja pasar a nadie—, pero ahora
   * lleva CUÁL de las tres formas de estar cerrada es. Sin esto la Mini App
   * solo sabía decir "ya se completó o fue cancelada", y se lo decía igual a
   * quien ya estaba dentro del grupo que a quien seguía esperando.
   */
  const desenlaceDe = async (
    guard: GuardianSessionGuard,
  ): Promise<string | undefined> => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      await guard.canActivate(contexto as any);
    } catch (err) {
      return (
        err as { getResponse: () => { desenlace?: string } }
      ).getResponse().desenlace;
    }
    throw new Error("se esperaba un portazo del guard y no lo hubo");
  };

  it("a quien la IA aprobó sola le manda 'aprobada', no un caso cancelado", async () => {
    const guard = await conEstado("resolved", { decision: "auto_approve" });
    expect(await desenlaceDe(guard)).toBe("aprobada");
  });

  it("a quien espera al staff le manda 'en-revision'", async () => {
    const guard = await conEstado("resolved", { decision: "manual_review" });
    expect(await desenlaceDe(guard)).toBe("en-revision");
  });

  it("mira el veredicto del staff, no solo la decisión de la IA", async () => {
    const guard = await conEstado("resolved", {
      decision: "manual_review",
      accionesDeStaff: ["approve"],
    });
    expect(await desenlaceDe(guard)).toBe("aprobada");
  });

  it("a una sesión reemplazada le manda al botón nuevo", async () => {
    const guard = await conEstado("cancelled");
    expect(await desenlaceDe(guard)).toBe("reemplazada");
  });

  it("un fallo leyendo al staff no se lleva por delante el portazo", async () => {
    // La consulta del staff solo elige un texto. Si revienta, el guard tiene
    // que seguir cerrando la puerta igual y caer en la lectura prudente.
    const guard = await conEstado("resolved", { decision: "manual_review" });
    // biome-ignore lint/suspicious/noExplicitAny: pinchando el doble para simular el fallo
    (guard as any).guardian.listStaffDecisions = () =>
      Promise.reject(new Error("base de datos caída"));
    expect(await desenlaceDe(guard)).toBe("en-revision");
  });
});

describe("GuardianSessionGuard — per-user rate limit", () => {
  it("throttles a user after their burst, without affecting a different user on the same guard", async () => {
    const repo = new InMemoryGuardianRepository();
    const sessionA = await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100123n,
      telegramUserId: 555n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken("token-a"),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "idem-a",
    });
    const sessionB = await repo.createSession({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100124n,
      telegramUserId: 777n,
      mode: "auto",
      challengeDefinition: { steps: [], nonce: "n", difficulty: "normal" },
      challengeNonce: "n",
      sessionTokenHash: hashSessionToken("token-b"),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "idem-b",
    });
    expect(sessionA).not.toBeNull();
    expect(sessionB).not.toBeNull();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;

    const contextA = fakeExecutionContext({
      "x-guardian-session": "token-a",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    for (let i = 0; i < 20; i += 1) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      expect(await guard.canActivate(contextA as any)).toBe(true);
    }
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(contextA as any),
      "rate-limited",
    );

    // Same guard instance, different user's session: independent budget.
    const contextB = fakeExecutionContext({
      "x-guardian-session": "token-b",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "777",
    });
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
    expect(await guard.canActivate(contextB as any)).toBe(true);
  });

  it("still enforces session-not-found before the rate limiter ever runs", async () => {
    const repo = new InMemoryGuardianRepository();
    const guard = new GuardianSessionGuard();
    // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
    (guard as any).guardian = repo;
    const context = fakeExecutionContext({
      "x-guardian-session": "no-such-token",
      "x-guardian-test-bypass": "1",
      "x-guardian-test-user": "555",
    });
    await expectRejectsWithError(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake ExecutionContext
      guard.canActivate(context as any),
      "session-not-found",
    );
  });
});
